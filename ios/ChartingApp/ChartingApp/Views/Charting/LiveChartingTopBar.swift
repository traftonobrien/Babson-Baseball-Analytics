import SwiftUI
import SwiftData

struct LiveChartingTopBar: View {
    @Bindable var gameStore: GameStore
    @Bindable var chartingState: ChartingState
    let hitterRosterPlayers: [BootstrapRosterPlayer]
    let presentHistory: () -> Void
    let presentGameCorrection: () -> Void
    let selectPitcher: (PersistedBootstrapPitcher) -> Void
    let selectLineupHitter: (PersistedLineupEntry) -> Void
    let selectRosterHitter: (BootstrapRosterPlayer) -> Void
    let pitchControlBlockedReason: String?

    private var isLiveABMode: Bool { chartingState.mode == .liveAB }

    private var currentPitcherProfile: PersistedBootstrapPitcher? {
        if isLiveABMode {
            let playerId = chartingState.currentLiveABSession?.setup.pitcherPlayerId ?? chartingState.liveABSetup.pitcherPlayerId
            return gameStore.pitchers.first(where: { $0.playerId == playerId })
        }
        return gameStore.activePitcherProfile
    }

    private var currentPitcherName: String {
        if isLiveABMode {
            let name = chartingState.currentLiveABSession?.setup.pitcherName ?? chartingState.liveABSetup.pitcherName
            return name.isEmpty ? "Select Pitcher" : name
        }
        return gameStore.activeSegments.last?.displayName ?? "Add Pitcher"
    }

    private var currentPitcherThrows: String {
        if isLiveABMode {
            return chartingState.currentLiveABSession?.setup.pitcherThrowsHand
                ?? chartingState.liveABSetup.pitcherThrowsHand
        }
        return currentPitcherProfile?.throwsHand ?? "R"
    }

    private var currentHitterName: String {
        if isLiveABMode {
            let name = chartingState.currentLiveABSession?.setup.hitterName ?? chartingState.liveABSetup.hitterName
            return name.isEmpty ? "Set Hitter" : name
        }
        let slot = chartingState.gameLineupOverrideSlot ?? gameStore.currentBatterSlot
        return chartingState.resolvedGameHitterOverrideName
            ?? gameStore.activeLineup.first(where: { $0.lineupSlot == slot })?.hitterName
            ?? "Unknown Hitter"
    }

    private var currentHalfInning: ChartingHalfInning {
        if isLiveABMode {
            return chartingState.currentLiveABSession?.setup.halfInning ?? chartingState.liveABSetup.halfInning
        }
        return gameStore.isTopInning ? .top : .bottom
    }

    private var currentInning: Int {
        if isLiveABMode {
            return chartingState.currentLiveABSession?.setup.inning ?? chartingState.liveABSetup.inning
        }
        return gameStore.currentInning
    }

    private var currentOuts: Int {
        if isLiveABMode {
            return chartingState.currentLiveABSession?.setup.outs ?? chartingState.liveABSetup.outs
        }
        return gameStore.currentOuts
    }

    private var currentBalls: Int {
        if isLiveABMode {
            return chartingState.currentLiveABSession?.currentBalls ?? chartingState.liveABSetup.startingBalls
        }
        return gameStore.currentBalls
    }

    private var currentStrikes: Int {
        if isLiveABMode {
            return chartingState.currentLiveABSession?.currentStrikes ?? chartingState.liveABSetup.startingStrikes
        }
        return gameStore.currentStrikes
    }

    private var pitcherPitchTotal: Int {
        if isLiveABMode, let playerId = currentPitcherProfile?.playerId {
            return chartingState.liveABPitcherTotal(playerId: playerId)
        }
        return gameStore.currentPitcherPitchTotal
    }

    private var inningPitchTotal: Int {
        if isLiveABMode {
            return chartingState.liveABInningTotal(inning: currentInning, halfInning: currentHalfInning)
        }
        return gameStore.currentInningPitchTotal
    }

    private var gamePitchTotal: Int {
        if isLiveABMode {
            return chartingState.liveABGamePitchTotal
        }
        return gameStore.totalPitchCount
    }

    private var selectedPitcherPlayerId: String? {
        if isLiveABMode {
            return chartingState.currentLiveABSession?.setup.pitcherPlayerId ?? chartingState.liveABSetup.pitcherPlayerId
        }
        return gameStore.activeSegments.last?.playerId
    }

    private var canEditGameMatchup: Bool {
        guard !isLiveABMode else { return true }
        return gameStore.activeGame != nil && gameStore.liveState.openPAId == nil
    }

    private var canSelectPitcherFromBar: Bool {
        !gameStore.pitchers.isEmpty && (isLiveABMode || canEditGameMatchup)
    }

    private var canSelectHitterFromBar: Bool {
        (!gameStore.activeLineup.isEmpty || !hitterRosterPlayers.isEmpty) && (isLiveABMode || canEditGameMatchup)
    }

    private var pitcherSelectorSubtitle: String? {
        guard selectedPitcherPlayerId != nil || isLiveABMode else { return "Choose current pitcher" }
        return currentPitcherThrows == "L" ? "LHP" : "RHP"
    }

    private var hitterSelectorSubtitle: String? {
        if isLiveABMode {
            return chartingState.currentLiveABSession == nil ? "Choose current hitter" : "Live AB hitter"
        }
        return "#\(chartingState.gameLineupOverrideSlot ?? gameStore.currentBatterSlot)"
    }

    private var canEditLiveABCountPreset: Bool {
        guard isLiveABMode else { return false }
        return chartingState.currentLiveABSession?.pitches.isEmpty ?? true
    }

    private var correctionLabel: String? {
        guard chartingState.hasGameCorrection else { return nil }
        if let slot = chartingState.gameLineupOverrideSlot {
            return "Next AB queued to #\(slot)"
        }
        return "Next AB correction queued"
    }

    // MARK: - Views

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            topBarWorkspace
                .frame(maxWidth: .infinity, alignment: .leading)

            if correctionLabel != nil || (!isLiveABMode && gameStore.errorMessage != nil) || pitchControlBlockedReason != nil {
                topBarMessageBanner
            }
        }
        // SurfaceCard modifier is applied at the call site in LiveChartingView
    }



    private var topBarWorkspace: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .center, spacing: 10) {
                topBarMetricsStrip
                    .frame(maxWidth: .infinity, alignment: .leading)

                topBarActions
            }

            // Unified Matchup + Count Card to reduce vertical height and clutter
            HStack(alignment: .center, spacing: 12) {
                pitcherSelector
                    .frame(minWidth: 0, maxWidth: .infinity)

                Divider().frame(height: 24)

                hitterSelector
                    .frame(minWidth: 0, maxWidth: .infinity)

                Divider().frame(height: 24)

                CountBadge(
                    title: isLiveABMode ? "Live Count" : "Count",
                    balls: currentBalls,
                    strikes: currentStrikes,
                    preset: isLiveABMode ? chartingState.currentLiveABCountPreset : nil,
                    canEditPreset: canEditLiveABCountPreset,
                    onSelectPreset: isLiveABMode ? { chartingState.setLiveABCountPreset($0) } : nil
                )
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.white.opacity(0.5)) // Unified background
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }

    private var topBarMetricsStrip: some View {
        HStack(spacing: 10) {
            inningMetricPill
            outsMetricPill
            MetricPill(title: "Pitcher Pitches", value: "\(pitcherPitchTotal)", accent: .purple)
            MetricPill(title: "This Inning", value: "\(inningPitchTotal)", accent: .green)
            MetricPill(title: "Game Total", value: "\(gamePitchTotal)", accent: .primary)
        }
        .padding(8)
        .background(Color.white.opacity(0.4))
        .clipShape(Capsule())
    }

    @ViewBuilder
    private var inningMetricPill: some View {
        if isLiveABMode {
            MetricPill(title: "Inning", value: "\(currentHalfInning.shortLabel) \(currentInning)", accent: .blue)
        } else {
            Menu {
                Section("Top") {
                    ForEach(1...12, id: \.self) { inning in
                        Button {
                            gameStore.applyGameStateOverride(
                                inning: inning,
                                halfInning: .top,
                                outs: currentOuts
                            )
                        } label: {
                            HStack {
                                Text("Top \(inning)")
                                if currentHalfInning == .top && currentInning == inning {
                                    Spacer()
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                }

                Section("Bottom") {
                    ForEach(1...12, id: \.self) { inning in
                        Button {
                            gameStore.applyGameStateOverride(
                                inning: inning,
                                halfInning: .bottom,
                                outs: currentOuts
                            )
                        } label: {
                            HStack {
                                Text("Bot \(inning)")
                                if currentHalfInning == .bottom && currentInning == inning {
                                    Spacer()
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                }
            } label: {
                MetricPill(
                    title: "Inning",
                    value: "\(currentHalfInning.shortLabel) \(currentInning)",
                    accent: .blue,
                    showsDisclosure: true
                )
            }
            .buttonStyle(.plain)
            .disabled(!gameStore.canEditGameState)
        }
    }

    @ViewBuilder
    private var outsMetricPill: some View {
        if isLiveABMode {
            MetricPill(title: "Outs", value: "\(currentOuts)", accent: .orange)
        } else {
            Menu {
                ForEach(0...2, id: \.self) { outs in
                    Button {
                        gameStore.applyGameStateOverride(
                            inning: currentInning,
                            halfInning: currentHalfInning,
                            outs: outs
                        )
                    } label: {
                        HStack {
                            Text("\(outs) Outs")
                            if currentOuts == outs {
                                Spacer()
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
            } label: {
                MetricPill(
                    title: "Outs",
                    value: "\(currentOuts)",
                    accent: .orange,
                    showsDisclosure: true
                )
            }
            .buttonStyle(.plain)
            .disabled(!gameStore.canEditGameState)
        }
    }

    @ViewBuilder
    private var topBarActions: some View {
        HStack(spacing: 8) {
            if !isLiveABMode {
                TopBarActionButton(
                    title: chartingState.hasGameCorrection ? "Queued AB" : "Next AB",
                    systemImage: "arrow.triangle.branch",
                    accent: .blue,
                    action: presentGameCorrection
                )
            }

            TopBarActionButton(
                title: "History",
                systemImage: "clock.arrow.trianglehead.counterclockwise.rotate.90",
                accent: .primary,
                action: presentHistory
            )
        }
    }



    private var topBarMessageBanner: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let correctionLabel, !isLiveABMode {
                Label(correctionLabel, systemImage: "arrow.triangle.branch")
                    .font(.caption)
                    .foregroundStyle(.blue)
            }

            if let pitchControlBlockedReason, gameStore.errorMessage == nil {
                Label(pitchControlBlockedReason, systemImage: "info.circle")
                    .font(.caption)
                    .foregroundStyle(.orange)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let errorMessage = gameStore.errorMessage, !isLiveABMode {
                Label(errorMessage, systemImage: "wifi.slash")
                    .font(.caption)
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.4))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var pitcherSelector: some View {
        Menu {
            ForEach(gameStore.pitchers, id: \.playerId) { pitcher in
                Button {
                    selectPitcher(pitcher)
                } label: {
                    HStack {
                        Text("\(pitcher.name) (\(pitcher.throwsHand == "L" ? "LHP" : "RHP"))")
                        if selectedPitcherPlayerId == pitcher.playerId {
                            Spacer()
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            MatchupSelectorLabel(
                title: "Pitcher",
                value: currentPitcherName,
                subtitle: pitcherSelectorSubtitle,
                isPlaceholder: selectedPitcherPlayerId == nil,
                isEnabled: canSelectPitcherFromBar
            )
            .contentShape(Rectangle()) // makes entire area tappable
        }
        .buttonStyle(.plain)
        .disabled(!canSelectPitcherFromBar)
    }

    private var hitterSelector: some View {
        Menu {
            if !gameStore.activeLineup.isEmpty {
                Section("Lineup") {
                    ForEach(gameStore.activeLineup, id: \.id) { entry in
                        Button {
                            selectLineupHitter(entry)
                        } label: {
                            HStack {
                                Text("#\(entry.lineupSlot) \(entry.hitterName)")
                                if !isLiveABMode && currentHitterName == entry.hitterName && (chartingState.gameLineupOverrideSlot ?? gameStore.currentBatterSlot) == entry.lineupSlot {
                                    Spacer()
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                }
            }

            if !hitterRosterPlayers.isEmpty {
                Section("Roster") {
                    ForEach(hitterRosterPlayers, id: \.id) { player in
                        Button {
                            selectRosterHitter(player)
                        } label: {
                            HStack {
                                Text(player.name)
                                if currentHitterName == player.name {
                                    Spacer()
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                }
            }
        } label: {
            MatchupSelectorLabel(
                title: "Hitter",
                value: currentHitterName,
                subtitle: hitterSelectorSubtitle,
                isPlaceholder: currentHitterName == "Unknown Hitter" || currentHitterName == "Set Hitter",
                isEnabled: canSelectHitterFromBar
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!canSelectHitterFromBar)
    }
}
