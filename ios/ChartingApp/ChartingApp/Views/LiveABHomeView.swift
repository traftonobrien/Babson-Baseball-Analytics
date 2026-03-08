import SwiftUI

/// Pre-charting setup screen for Live AB mode.
/// User configures pitcher, hitter, and context here, then taps Start.
struct LiveABHomeView: View {
    @Bindable var gameStore: GameStore

    @State private var setup = LiveABSetup()
    @State private var isChartingActive = false
    @State private var isShowingHitterPicker = false

    private var hitterRosterPlayers: [BootstrapRosterPlayer] {
        gameStore.rosterPlayers.filter(\.canAppearInHitterPicker)
    }

    private var selectedPitcher: PersistedBootstrapPitcher? {
        gameStore.pitchers.first { $0.playerId == setup.pitcherPlayerId }
    }

    var body: some View {
        NavigationStack {
            Form {
                // MARK: Matchup
                Section("Matchup") {
                    // Pitcher
                    if gameStore.pitchers.isEmpty {
                        Label("No pitchers loaded. Refresh bootstrap in Settings.", systemImage: "exclamationmark.triangle")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    } else {
                        Menu {
                            ForEach(gameStore.pitchers, id: \.playerId) { pitcher in
                                Button {
                                    setup.pitcherPlayerId = pitcher.playerId
                                    setup.pitcherName = pitcher.name
                                    setup.pitcherThrowsHand = pitcher.throwsHand
                                } label: {
                                    HStack {
                                        Text("\(pitcher.name) (\(pitcher.throwsHand == "L" ? "LHP" : "RHP"))")
                                        if setup.pitcherPlayerId == pitcher.playerId {
                                            Spacer()
                                            Image(systemName: "checkmark")
                                        }
                                    }
                                }
                            }
                        } label: {
                            HStack {
                                Text("Pitcher")
                                Spacer()
                                Text(setup.pitcherName.isEmpty ? "Select Pitcher" : "\(setup.pitcherName) (\(setup.pitcherThrowsHand == "L" ? "LHP" : "RHP"))")
                                    .foregroundStyle(setup.pitcherName.isEmpty ? .secondary : .primary)
                                    .lineLimit(1)
                                Image(systemName: "chevron.up.chevron.down")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .tint(.primary)
                    }

                    // Hitter from roster
                    if !hitterRosterPlayers.isEmpty {
                        Button {
                            isShowingHitterPicker = true
                        } label: {
                            HStack {
                                Text("Hitter")
                                Spacer()
                                Text(setup.hitterName.isEmpty ? "Choose from roster" : setup.hitterName)
                                    .foregroundStyle(setup.hitterName.isEmpty ? .secondary : .primary)
                                    .lineLimit(1)
                            }
                        }
                        .tint(.primary)
                    }

                    // Manual hitter name
                    TextField(hitterRosterPlayers.isEmpty ? "Hitter name" : "Or enter manually", text: $setup.hitterName)
                        .textInputAutocapitalization(.words)
                }

                // MARK: Context
                Section("Context") {
                    Picker("Half", selection: $setup.halfInning) {
                        ForEach(ChartingHalfInning.allCases) { half in
                            Text(half.rawValue).tag(half)
                        }
                    }
                    Picker("Inning", selection: $setup.inning) {
                        ForEach(1...12, id: \.self) { inning in
                            Text("\(inning)").tag(inning)
                        }
                    }
                    Picker("Outs", selection: $setup.outs) {
                        ForEach(0...2, id: \.self) { outs in
                            Text("\(outs)").tag(outs)
                        }
                    }
                }

                // MARK: Count Preset
                Section("Count Preset") {
                    Picker("Preset", selection: $setup.countPreset) {
                        ForEach(LiveABCountPreset.allCases) { preset in
                            Text(preset.rawValue).tag(preset)
                        }
                    }
                    .pickerStyle(.segmented)

                    Text(setup.countPreset.detailText)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                // MARK: Start
                Section {
                    Button {
                        isChartingActive = true
                    } label: {
                        HStack {
                            Spacer()
                            Label("Start Charting", systemImage: "play.circle.fill")
                                .font(.headline)
                            Spacer()
                        }
                    }
                    .disabled(!setup.isReady)
                }
            }
            .navigationTitle("Live AB")
            .navigationDestination(isPresented: $isChartingActive) {
                LiveChartingView(
                    gameStore: gameStore,
                    initialMode: .liveAB,
                    initialLiveABSetup: setup
                )
            }
            .sheet(isPresented: $isShowingHitterPicker) {
                LiveABRosterPickerSheet(
                    title: "Select Hitter",
                    players: hitterRosterPlayers
                ) { player in
                    setup.hitterName = player.name
                }
            }
            .onAppear {
                if gameStore.pitchers.isEmpty || gameStore.rosterPlayers.isEmpty {
                    Task { await gameStore.fetchBootstrap() }
                }
            }
        }
    }
}
