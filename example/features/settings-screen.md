# Feature: settings screen

## Settings screen
<!-- anaxi: @settings · depth: D4 · risk: 0·0·1·0 · about: ui · focus: now -->

**Why.** Users need one place to change working hours and quiet hours. **What.** Two time-range pickers that save
on change; acceptance: the change applies to the next planning run.

**Build.** `SettingsView.swift` with a `Form` of two `TimeRangePicker`s bound to `SettingsModel`…
(three pages of SwiftUI code follow)
