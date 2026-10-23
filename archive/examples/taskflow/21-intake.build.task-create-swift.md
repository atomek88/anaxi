# TaskFlow — build leaf: iOS task creation

Parent: [[TF.task-create-flow]] in [20-intake.md](20-intake.md). This leaf makes no design decisions; it
implements the ones it cites and records only local choices.

## TF.task-create-swift · Swift implementation of strategies, outbox, submitter, and routes
> up: TF.task-create-flow · kind: build · state: settled · decided-by: D-TF-03, D-TF-04, D-TF-05, D-TF-09 · links: calls→TF.submission-envelope, authenticates-with→TF.auth

### Module layout
```
TaskFlow/Creation/
  Models.swift             TaskDraft, CreationMode, CreationContext, CreationError
  Strategies.swift         TaskCreationStrategy + Typed / Voice / DoNow
  CreationCoordinator.swift  picks the strategy for an entry point, hands the draft to the submitter
  Outbox.swift             OutboxItem (@Model), OutboxStore (@ModelActor)
  TaskSubmitter.swift      drains the outbox, implements the state table of TF.task-create-flow
  API/Route.swift          the three task routes, exactly as in the API contract
  API/APIClient.swift      auth header, one forced refresh on 401, error mapping
  Intents/DoNowIntent.swift  App Intent for Siri / Shortcuts / widget
```

### Models
```swift
enum CreationMode: String, Codable, Sendable { case typed, voice, doNow }
enum Channel: String, Codable, Sendable { case app, voice }

struct TaskDraft: Codable, Equatable, Sendable {
    let submissionId: String              // UUID v4, lowercase; never regenerated on retry (D-TF-05)
    var text: String
    var title: String?
    var durationMinutes: Int?
    var deadline: Date?
    var doNow: Bool
    var channel: Channel
    var localAudioPath: String?           // device only; excluded from every request body
    var audioUploadId: String?

    static func new(text: String, channel: Channel, doNow: Bool = false) -> TaskDraft {
        TaskDraft(submissionId: UUID().uuidString.lowercased(), text: text, title: nil,
                  durationMinutes: nil, deadline: nil, doNow: doNow, channel: channel,
                  localAudioPath: nil, audioUploadId: nil)
    }
}

struct CreationContext: Sendable {
    let now: Date
    let prefill: String?                  // App Intent parameter or share-sheet text
}

enum CreationError: Error, Equatable { case cancelled, invalid(String) }
```

### Strategies (D-TF-04)
```swift
protocol TaskCreationStrategy: Sendable {
    var mode: CreationMode { get }
    func makeDraft(context: CreationContext) async throws -> TaskDraft
}

struct TypedEntryStrategy: TaskCreationStrategy {
    let mode = CreationMode.typed
    let form: TypedEntryForm              // presents the sheet; nil when dismissed

    func makeDraft(context: CreationContext) async throws -> TaskDraft {
        guard let input = await form.present(prefill: context.prefill) else { throw CreationError.cancelled }
        let text = input.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (1...500).contains(text.count) else { throw CreationError.invalid("A task needs 1–500 characters.") }
        if let deadline = input.deadline, deadline <= context.now {
            throw CreationError.invalid("The deadline has to be in the future.")
        }
        var draft = TaskDraft.new(text: text, channel: .app)
        draft.title = input.title
        draft.durationMinutes = input.durationMinutes
        draft.deadline = input.deadline
        return draft
    }
}

struct VoiceStrategy: TaskCreationStrategy {
    let mode = CreationMode.voice
    let recorder: VoiceRecorder           // AVAudioRecorder wrapper: AAC, 44.1 kHz, mono, .m4a in Application Support

    func makeDraft(context: CreationContext) async throws -> TaskDraft {
        let clip = try await recorder.record(maxDuration: 60)        // throws .cancelled on swipe-away
        guard clip.duration >= 1 else { throw CreationError.invalid("Hold to record for at least a second.") }
        var draft = TaskDraft.new(text: "", channel: .voice)
        draft.localAudioPath = clip.fileURL.path                     // uploaded later by TaskSubmitter
        return draft
    }
}

struct DoNowStrategy: TaskCreationStrategy {
    let mode = CreationMode.doNow
    let prompt: OneLinePrompt

    func makeDraft(context: CreationContext) async throws -> TaskDraft {
        var raw = context.prefill
        if raw == nil { raw = await prompt.ask("What are you doing now?") }
        guard let text = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else {
            throw CreationError.cancelled
        }
        var draft = TaskDraft.new(text: String(text.prefix(500)), channel: .app, doNow: true)
        draft.durationMinutes = 25
        return draft
    }
}
```

### Coordinator: the only place that knows which strategy ran
```swift
enum CreationResult: Equatable { case queued(String), cancelled, invalid(String), failed(String) }

struct CreationCoordinator: Sendable {
    let strategies: [CreationMode: any TaskCreationStrategy]
    let submitter: TaskSubmitter

    func create(_ mode: CreationMode, context: CreationContext) async -> CreationResult {
        guard let strategy = strategies[mode] else { preconditionFailure("no strategy registered for \(mode)") }
        do {
            let draft = try await strategy.makeDraft(context: context)
            try await submitter.enqueue(draft)
            return .queued(draft.submissionId)
        } catch CreationError.cancelled {
            return .cancelled
        } catch CreationError.invalid(let reason) {
            return .invalid(reason)
        } catch {
            return .failed(String(describing: error))       // outbox write failed: disk full or store corrupt
        }
    }
}
```
Registration happens once in `AppServices`: `[.typed: TypedEntryStrategy(...), .voice: VoiceStrategy(...),
.doNow: DoNowStrategy(...)]`. Adding a mode is one new type and one dictionary entry.

### Outbox (D-TF-09)
```swift
import SwiftData

enum OutboxState: String, Codable { case saved, sending, retryWait, acknowledged, rejected, needsSignIn }

@Model final class OutboxItem {
    @Attribute(.unique) var submissionId: String
    var draftJSON: Data
    var state: String
    var attempts: Int
    var nextAttemptAt: Date
    var lastError: String?
    var createdAt: Date

    init(_ draft: TaskDraft) throws {
        submissionId = draft.submissionId
        draftJSON = try JSONEncoder().encode(draft)
        state = OutboxState.saved.rawValue
        attempts = 0
        nextAttemptAt = .now
        createdAt = .now
    }
}

struct OutboxSnapshot: Sendable { let draft: TaskDraft; let attempts: Int }

@ModelActor
actor OutboxStore {
    func save(_ draft: TaskDraft) throws {
        modelContext.insert(try OutboxItem(draft))
        try modelContext.save()
    }

    func due(now: Date) throws -> OutboxSnapshot? {
        let saved = OutboxState.saved.rawValue, waiting = OutboxState.retryWait.rawValue
        var fetch = FetchDescriptor<OutboxItem>(
            predicate: #Predicate { ($0.state == saved || $0.state == waiting) && $0.nextAttemptAt <= now },
            sortBy: [SortDescriptor(\.createdAt)])
        fetch.fetchLimit = 1
        guard let item = try modelContext.fetch(fetch).first else { return nil }
        return OutboxSnapshot(draft: try JSONDecoder().decode(TaskDraft.self, from: item.draftJSON),
                              attempts: item.attempts)
    }

    func mark(_ id: String, _ state: OutboxState, draft: TaskDraft? = nil, attempts: Int? = nil,
              retryAt: Date? = nil, error: String? = nil) throws {
        let fetch = FetchDescriptor<OutboxItem>(predicate: #Predicate { $0.submissionId == id })
        guard let item = try modelContext.fetch(fetch).first else { return }
        item.state = state.rawValue
        if let draft { item.draftJSON = try JSONEncoder().encode(draft) }
        if let attempts { item.attempts = attempts }
        if let retryAt { item.nextAttemptAt = retryAt }
        item.lastError = error
        try modelContext.save()
    }
}
```

### Submitter: the state table of TF.task-create-flow, line for line
```swift
actor TaskSubmitter {
    private let outbox: OutboxStore
    private let api: APIClient
    private var draining = false

    init(outbox: OutboxStore, api: APIClient) { self.outbox = outbox; self.api = api }

    func enqueue(_ draft: TaskDraft) async throws {
        try await outbox.save(draft)                       // durable before any network call
        Task { await drain() }
    }

    /// Called after enqueue, on app foreground, on network-path change, and from the BGAppRefreshTask.
    func drain() async {
        guard !draining else { return }
        draining = true
        defer { draining = false }
        while let next = try? await outbox.due(now: .now) { await send(next) }
    }

    private func send(_ item: OutboxSnapshot) async {
        var draft = item.draft
        let id = draft.submissionId
        try? await outbox.mark(id, .sending)
        do {
            switch draft.channel {
            case .app:
                _ = try await api.send(.submitTask(draft), as: Accepted.self)
            case .voice:
                if draft.audioUploadId == nil, let path = draft.localAudioPath {
                    let upload = try await api.send(.createVoiceUpload, as: VoiceUpload.self)
                    try await api.putAudio(URL(fileURLWithPath: path), to: upload.uploadUrl)
                    draft.audioUploadId = upload.audioUploadId
                    try await outbox.mark(id, .sending, draft: draft)      // never upload the same clip twice
                }
                _ = try await api.send(.submitVoice(draft), as: Accepted.self)
            }
            try? await outbox.mark(id, .acknowledged)
        } catch APIError.http(409, _) where draft.channel == .voice {
            try? await outbox.mark(id, .acknowledged)                    // an earlier attempt got through
        } catch APIError.http(404, _) where draft.channel == .voice {
            draft.audioUploadId = nil                                    // upload expired: upload again
            try? await outbox.mark(id, .retryWait, draft: draft, attempts: item.attempts + 1, retryAt: .now + 2)
        } catch APIError.http(let status, let message) where [400, 409, 422].contains(status) {
            try? await outbox.mark(id, .rejected, error: message)
        } catch APIError.unauthorized {
            try? await outbox.mark(id, .needsSignIn)
        } catch {
            let attempts = item.attempts + 1
            let delay = min(300, 2 * pow(2, Double(attempts - 1)))      // 2, 4, 8 … 300 s
            try? await outbox.mark(id, .retryWait, attempts: attempts, retryAt: .now + delay,
                                   error: String(describing: error))
        }
    }
}
```

### Routes and client: exactly the API contract of the parent
```swift
struct Accepted: Decodable { let submissionId: String; let status: String }
struct VoiceUpload: Decodable { let audioUploadId: String; let uploadUrl: URL; let expiresAt: Date }
struct ErrorBody: Decodable { let message: String }

enum Route {
    case submitTask(TaskDraft)
    case createVoiceUpload
    case submitVoice(TaskDraft)

    var path: String {
        switch self {
        case .submitTask: "/v1/tasks"
        case .createVoiceUpload: "/v1/voice-uploads"
        case .submitVoice(let d): "/v1/voice-uploads/\(d.audioUploadId!)/submit"
        }
    }

    var body: (any Encodable)? {
        switch self {
        case .submitTask(let d):
            TaskBody(submissionId: d.submissionId, text: d.text, title: d.title, durationMinutes: d.durationMinutes,
                     deadline: d.deadline, doNow: d.doNow, channel: d.channel)
        case .createVoiceUpload: nil
        case .submitVoice(let d): VoiceSubmitBody(submissionId: d.submissionId, doNow: d.doNow)
        }
    }
}

enum APIError: Error { case http(Int, String), unauthorized, retryable(Int) }

struct APIClient: Sendable {
    let baseURL = URL(string: "https://api.taskflow.app")!
    let session: URLSession
    let tokens: TokenProvider              // wraps the Cognito session (D-TF-03): Keychain refresh token

    func send<T: Decodable>(_ route: Route, as: T.Type) async throws -> T {
        var request = URLRequest(url: baseURL.appending(path: route.path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body = route.body { request.httpBody = try JSONEncoder.api.encode(body) }
        for forceRefresh in [false, true] {
            let token = try await tokens.accessToken(forceRefresh: forceRefresh)
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            let (data, response) = try await session.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            switch status {
            case 200..<300: return try JSONDecoder.api.decode(T.self, from: data)
            case 401 where !forceRefresh: continue                       // refresh once
            case 401: throw APIError.unauthorized
            case 429, 500...: throw APIError.retryable(status)
            default: throw APIError.http(status, (try? JSONDecoder.api.decode(ErrorBody.self, from: data))?.message ?? "")
            }
        }
        throw APIError.unauthorized
    }

    func putAudio(_ file: URL, to url: URL) async throws {
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("audio/mp4", forHTTPHeaderField: "Content-Type")   // must match the presign
        let (_, response) = try await session.upload(for: request, fromFile: file)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 403 { throw APIError.http(404, "upload URL expired") }  // same path as an expired upload
        guard (200..<300).contains(status) else { throw APIError.retryable(status) }
    }
}
```
`JSONEncoder.api` / `JSONDecoder.api` use `.iso8601` dates, so `deadline` goes out as `2026-10-09T23:59:00Z`.

### Do-now App Intent
```swift
import AppIntents

struct DoNowIntent: AppIntent {
    static let title: LocalizedStringResource = "Do a task now"
    @Parameter(title: "Task") var task: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let result = await AppServices.shared.coordinator.create(.doNow,
                         context: CreationContext(now: .now, prefill: task))
        switch result {
        case .queued:              return .result(dialog: "Got it. I'll find the next free slot.")
        case .invalid(let reason): return .result(dialog: "\(reason)")
        case .cancelled:           return .result(dialog: "Cancelled.")
        case .failed:              return .result(dialog: "I couldn't save that. Try again in the app.")
        }
    }
}
```

### Interop with neighbors
| Neighbor | What this leaf relies on | Where it is defined |
|---|---|---|
| Auth | `TokenProvider.accessToken(forceRefresh:)` returns a Cognito access token; a second 401 means sign-in is needed | [[TF.auth]] |
| Envelope | `submitTask` copies the body into envelope `hints` and takes `userId` from the token, never the body | [[TF.submission-envelope]] |
| Queue dedup | resending the same `submissionId` is safe for 5 min in SQS and forever at the conditional put | [[D-TF-05]] |
| Voice pipeline | `doNow` travels on the voice submit call because the transcript arrives later | [[TF.channel-gateway]] |
| Notifications | the "Placed" push deep link `taskflow://task/<id>` opens the task; this leaf only registers the URL scheme | [[TF.notifications]] |

### Local choices
- Local choice: the outbox drains serially, oldest first. Parallel sends would gain nothing at a few drafts
  per day and would break the per-user order that the FIFO queue preserves downstream.
- Local choice: an expired presigned URL (S3 `403`) is mapped to the expired-upload path, so there is one
  re-upload branch, not two.

### Tests (XCTest)
| Test | Arrange | Expect |
|---|---|---|
| `typedTrimsAndValidates` | form returns `"  pay rent  "` | draft text `"pay rent"`, channel `app`, `doNow` false |
| `typedRejectsPastDeadline` | deadline = now − 1 min | `.invalid("The deadline has to be in the future.")` |
| `voiceDoesNotTouchNetwork` | stub recorder, API spy | draft has `localAudioPath`, API spy saw no calls |
| `outboxBeforeNetwork` | API stub that crashes on first call | `OutboxItem` exists with state `saved` before the call |
| `retryReusesSubmissionId` | API returns 503, then 202 | both requests carry the same `submissionId`; final state `acknowledged` |
| `voice409IsSuccess` | submit returns 409 | state `acknowledged`, no user-visible error |
| `voice404Reuploads` | submit returns 404 once | second attempt calls `createVoiceUpload` again |
| `doubleUnauthorized` | API returns 401 twice | one forced refresh, then state `needsSignIn` |
| `rejectedKeepsDraft` | API returns 422 "title too long" | state `rejected`, message shown, draft editable |

### Edge cases, worked
- Typed in airplane mode, app killed, reopened on Wi-Fi: the item is still `saved`; `drain()` on foreground
  sends it with the original `submissionId`; the user saw "Got it" only after the 202.
- Voice clip recorded offline: upload happens on the first drain with network; if that is more than 24 hours
  after a failed submit, the 404 path uploads again from the local file, which is kept until `acknowledged`.
- Do-now from Siri while signed out: the outbox accepts it, the first send ends in `needsSignIn`, and it is
  sent after sign-in. The planner treats it as do-now at that later time.
