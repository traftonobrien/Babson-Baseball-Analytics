import SwiftUI
import SwiftData

/// The main touch interface for logging pitches.
struct LiveChartingView: View {
    @Bindable var gameStore: GameStore
    /// Mode is chosen before entering — it is fixed for the lifetime of this view.
    var initialMode: ChartingMode = .liveAB
    /// When provided, a Live AB session is started immediately on appear (skips the setup sheet).
    var initialLiveABSetup: LiveABSetup? = nil
    /// Called when the user exits Live AB charting, passes back all completed sessions.
    var onSessionsComplete: (([LiveABSession]) -> Void)? = nil

    @State private var chartingState = ChartingState()
    @State private var isShowingPACloseoutSheet = false
    @State private var requiresLandscapeOrientation = false
    @Environment(\.dismiss) private var dismiss

    private let outerPadding: CGFloat = 16
    private let layoutSpacing: CGFloat = 12

    var body: some View {
        GeometryReader { proxy in
            let contentWidth = max(proxy.size.width - outerPadding * 2, 1)
            let zoneWidth = contentWidth * 0.45
            let controlWidth = contentWidth - zoneWidth - layoutSpacing

            VStack(spacing: layoutSpacing) {
                LiveChartingTopBar(
                    gameStore: gameStore,
                    chartingState: chartingState,
                    hitterRosterPlayers: hitterRosterPlayers,
                    presentHistory: presentHistory,
                    presentGameCorrection: presentGameCorrection,
                    selectPitcher: selectPitcher,
                    selectLineupHitter: selectLineupHitter,
                    selectRosterHitter: selectRosterHitter,
                    pitchControlBlockedReason: pitchControlBlockedReason
                )

                HStack(alignment: .top, spacing: layoutSpacing) {
                    zoneWorkspace
                        .frame(width: zoneWidth)
                        .frame(maxHeight: .infinity)

                    controlStack
                        .frame(width: controlWidth, alignment: .top)
                        .frame(maxHeight: .infinity, alignment: .top)
                }
                .frame(maxHeight: .infinity, alignment: .top)
            }
            .padding(outerPadding)
            .onAppear {
                updateOrientationRequirement(for: proxy.size)
            }
            .onChange(of: proxy.size) { _, newSize in
                updateOrientationRequirement(for: newSize)
            }
        }
        .background(
            RadialGradient(
                colors: [Color(white: 1.0), Color(white: 0.92)],
                center: .top,
                startRadius: 0,
                endRadius: 1000
            )
            .ignoresSafeArea()
        )
        .navigationTitle(chartingState.mode.rawValue)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            LiveChartingBottomDock(
                gameStore: gameStore,
                chartingState: chartingState,
                pitchControlBlockedReason: pitchControlBlockedReason,
                isUndoDisabled: historyEntries.isEmpty,
                presentPACloseout: presentPACloseout,
                handleUndo: handleUndo
            )
                .padding(.horizontal, outerPadding)
                .padding(.bottom, 8)
        }
        .blur(radius: requiresLandscapeOrientation ? 18 : 0)
        .overlay {
            if requiresLandscapeOrientation {
                LandscapeOrientationRequiredOverlay()
            }
        }
        .disabled(requiresLandscapeOrientation)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Exit") {
                    if chartingState.mode == .liveAB {
                        onSessionsComplete?(chartingState.completedLiveABSessions)
                    }
                    dismiss()
                }
            }
        }
        .navigationBarBackButtonHidden()
        .sheet(isPresented: $chartingState.isShowingHistory) {
            NavigationStack {
                PitchHistoryList(entries: historyEntries, onUndo: handleUndo)
                    .navigationTitle("Pitch History")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Done") {
                                chartingState.isShowingHistory = false
                            }
                        }
                    }
            }
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $chartingState.isShowingLiveABSetup) {
            LiveABSetupSheet(
                pitchers: gameStore.activePitchers,
                rosterPlayers: hitterRosterPlayers,
                initialSetup: chartingState.currentLiveABSession?.setup ?? chartingState.liveABSetup
            ) { setup in
                chartingState.beginLiveABSession(with: setup)
            }
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $chartingState.isShowingGameCorrection) {
            GameCorrectionSheet(
                lineup: gameStore.activeLineup,
                rosterPlayers: hitterRosterPlayers,
                initialSlot: chartingState.gameLineupOverrideSlot ?? gameStore.currentBatterSlot,
                initialHitterName: chartingState.resolvedGameHitterOverrideName
                    ?? gameStore.activeLineup.first(where: { $0.lineupSlot == gameStore.currentBatterSlot })?.hitterName
                    ?? ""
            ) { slot, hitterName in
                chartingState.applyGameCorrection(slot: slot, hitterName: hitterName)
            }
            .presentationDetents([.fraction(0.45), .medium])
        }
        .fullScreenCover(isPresented: $isShowingPACloseoutSheet) {
            PACloseoutSheet(
                availableResults: availablePAResults,
                statusMessage: paGuidanceText,
                submitResult: closePlateAppearance
            )
        }
        .onAppear {
            // Mode is fixed at entry — set it once and never change it.
            chartingState.mode = initialMode
            if let setup = initialLiveABSetup, initialMode == .liveAB {
                chartingState.beginLiveABSession(with: setup)
            } else if initialMode == .liveAB && chartingState.currentLiveABSession == nil {
                chartingState.isShowingLiveABSetup = true
            }
        }
        .onChange(of: needsPAClosure) { _, newValue in
            isShowingPACloseoutSheet = newValue
        }
    }

    private var isLiveABMode: Bool {
        chartingState.mode == .liveAB
    }

    private var activePitchesForCurrentPA: [PersistedPitch] {
        let currentPAId = gameStore.liveState.openPAId ?? gameStore.activePlateAppearances.last?.id
        return gameStore.activePitches.filter { $0.paId == currentPAId }
    }

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

    private var currentHitterDescriptor: String {
        if isLiveABMode {
            return currentHitterName
        }
        let slot = chartingState.gameLineupOverrideSlot ?? gameStore.currentBatterSlot
        return "\(currentHitterName) (#\(slot))"
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

    private var availablePitchTypes: [PitchType] {
        let types = isLiveABMode
            ? (currentPitcherProfile?.arsenalPitchTypes ?? PitchType.allCases)
            : gameStore.availablePitchTypesForActivePitcher()
        let uniqueTypes = Set(types)
        return PitchType.allCases.filter { uniqueTypes.contains($0) && $0 != .other }
    }

    private var historyEntries: [PitchHistoryEntry] {
        if isLiveABMode {
            return chartingState.liveABHistoryEntries
        }
        return activePitchesForCurrentPA.enumerated().map { offset, pitch in
            PitchHistoryEntry(
                id: pitch.id,
                pitchNumber: pitch.pitchOrder + 1,
                pitchTypeLabel: pitch.pitchType,
                resultLabel: pitch.pitchResult.replacingOccurrences(of: "_", with: " ").capitalized,
                countLabel: "\(pitch.ballsBefore)-\(pitch.strikesBefore)",
                locationLabel: pitch.locationCell.map { "Cell \($0)" },
                velocityLabel: pitch.velocity.map { "\($0) mph" }
            )
        }
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
        guard !isLiveABMode else {
            return true
        }
        return gameStore.activeGame != nil && gameStore.liveState.openPAId == nil
    }

    private var canSelectPitcherFromBar: Bool {
        !gameStore.activePitchers.isEmpty && (isLiveABMode || canEditGameMatchup)
    }

    private var hitterRosterPlayers: [BootstrapRosterPlayer] {
        gameStore.rosterPlayers.filter(\.canAppearInHitterPicker)
    }

    private var canSelectHitterFromBar: Bool {
        (!gameStore.activeLineup.isEmpty || !hitterRosterPlayers.isEmpty) && (isLiveABMode || canEditGameMatchup)
    }

    private var pitcherSelectorSubtitle: String? {
        guard selectedPitcherPlayerId != nil || isLiveABMode else {
            return "Choose current pitcher"
        }
        return currentPitcherThrows == "L" ? "LHP" : "RHP"
    }

    private var hitterSelectorSubtitle: String? {
        if isLiveABMode {
            return chartingState.currentLiveABSession == nil ? "Choose current hitter" : "Live AB hitter"
        }
        return "#\(chartingState.gameLineupOverrideSlot ?? gameStore.currentBatterSlot)"
    }

    private var canUsePitchControls: Bool {
        if isLiveABMode {
            return chartingState.currentLiveABSession != nil
        }
        return gameStore.activeSegments.last != nil
    }

    private var canSelectActionControls: Bool {
        canUsePitchControls && !needsPAClosure
    }

    private var canEditLiveABCountPreset: Bool {
        guard isLiveABMode else {
            return false
        }
        return chartingState.currentLiveABSession?.pitches.isEmpty ?? true
    }

    private var pitchControlBlockedReason: String? {
        if isLiveABMode && chartingState.currentLiveABSession == nil {
            if selectedPitcherPlayerId == nil {
                return "Select a pitcher and hitter to unlock pitch controls."
            }
            return chartingState.liveABSetup.hitterName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? "Select a hitter to start the at-bat."
                : "Select a hitter to start the next at-bat."
        }
        if needsPAClosure {
            return paGuidanceText
        }
        if !isLiveABMode && gameStore.activeSegments.last == nil {
            return "Add a pitcher before charting the next pitch."
        }
        return nil
    }

    private var needsPAClosure: Bool {
        if isLiveABMode {
            return chartingState.currentLiveABSession?.needsPAClosure ?? false
        }
        return gameStore.liveState.needsPAClosure
    }

    private var paGuidanceText: String {
        if isLiveABMode {
            return chartingState.currentLiveABSession?.guidanceText ?? "Select a hitter to begin charting."
        }
        return gameStore.liveState.guidanceText
    }

    private var availablePAResults: [PAResultType] {
        if isLiveABMode {
            return chartingState.currentLiveABSession?.availableResults ?? []
        }
        return gameStore.liveState.availableResults
    }

    private var canConfirmPitch: Bool {
        guard chartingState.isPendingPitchReady else {
            return false
        }
        if isLiveABMode {
            return chartingState.currentLiveABSession != nil && !needsPAClosure
        }
        return gameStore.activeSegments.last != nil && !needsPAClosure
    }

    private var correctionLabel: String? {
        guard chartingState.hasGameCorrection else {
            return nil
        }
        if let slot = chartingState.gameLineupOverrideSlot {
            return "Next AB queued to #\(slot)"
        }
        return "Next AB correction queued"
    }

    private var topUtilityBar: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                modeCluster
                    .frame(width: 220, alignment: .leading)

                topBarWorkspace
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            if correctionLabel != nil || (!isLiveABMode && gameStore.errorMessage != nil) || pitchControlBlockedReason != nil {
                topBarMessageBanner
            }
        }
        .modifier(SurfaceCard())
    }

    private var modeCluster: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Mode")
                .font(.caption.bold())
                .foregroundStyle(.secondary)

            Label(chartingState.mode.rawValue,
                  systemImage: isLiveABMode ? "figure.baseball" : "list.bullet.clipboard")
                .font(.subheadline.bold())
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .foregroundStyle(isLiveABMode ? .orange : .blue)
                .background((isLiveABMode ? Color.orange : Color.blue).opacity(0.12))
                .clipShape(Capsule())

            topBarStatusBadge
        }
        .modifier(InnerDeck())
    }

    private var topBarWorkspace: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 10) {
                topBarMetricsStrip
                    .frame(maxWidth: .infinity, alignment: .leading)

                topBarActions
            }

            HStack(alignment: .center, spacing: 12) {
                pitcherSelector
                    .frame(minWidth: 0, maxWidth: .infinity)

                hitterSelector
                    .frame(minWidth: 0, maxWidth: .infinity)

                CountBadge(
                    title: isLiveABMode ? "Live Count" : "Count",
                    balls: currentBalls,
                    strikes: currentStrikes,
                    preset: isLiveABMode ? chartingState.currentLiveABCountPreset : nil,
                    canEditPreset: canEditLiveABCountPreset,
                    onSelectPreset: isLiveABMode ? { chartingState.setLiveABCountPreset($0) } : nil
                )
                .frame(width: 280, alignment: .leading)
            }
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
        .modifier(CompactDeck())
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
                accent: .secondary,
                action: presentHistory
            )
        }
    }

    @ViewBuilder
    private var topBarStatusBadge: some View {
        if isLiveABMode {
            Label("Local Practice", systemImage: "figure.baseball")
                .font(.caption.bold())
                .foregroundStyle(.orange)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.orange.opacity(0.12))
                .clipShape(Capsule())
        } else {
            SyncStatusIndicator(status: gameStore.syncStatus)
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
        .frame(maxWidth: .infinity, alignment: .leading)
        .modifier(InnerDeck())
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
        }
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
        }
        .disabled(!canSelectHitterFromBar)
    }

    private var zoneWorkspace: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Zone Selection")
                        .font(.headline)
                    Text("Set location first, then complete the pitch from the control stack.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Text(chartingState.selectedLocation.map { "Zone \($0)" } ?? "No zone selected")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(chartingState.selectedLocation == nil ? Color.secondary : Color.blue)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.blue.opacity(chartingState.selectedLocation == nil ? 0.08 : 0.14))
                    .clipShape(Capsule())
            }

            Spacer(minLength: 0)
            ZoneGridView(state: chartingState)
                .frame(maxWidth: .infinity)
                .aspectRatio(1.0, contentMode: .fit)
            Spacer(minLength: 0)
        }
        .modifier(SurfaceCard())
    }

    private var controlStack: some View {
        VStack(spacing: layoutSpacing) {
            pitchTypeCard
            actionCard
        }
    }

    private var pitchTypeCard: some View {
        PitchTypePicker(state: chartingState, availablePitchTypes: availablePitchTypes)
            .modifier(SurfaceCard())
    }

    private var actionCard: some View {
        PitchResultControls(
            state: chartingState,
            availableResults: chartingState.availablePitchResults,
            isBuntMode: chartingState.isBuntModeActive,
            isInteractive: canSelectActionControls,
            blockedReason: pitchControlBlockedReason
        )
        .modifier(SurfaceCard())
    }

    private var bottomWorkflowDock: some View {
        Group {
            if needsPAClosure {
                HStack(alignment: .center, spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Close Plate Appearance")
                            .font(.headline)
                        Text(paGuidanceText)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }

                    Spacer(minLength: 12)

                    Button("Open Closeout", systemImage: "list.bullet.clipboard", action: presentPACloseout)
                        .controlSize(.large)
                        .buttonStyle(.borderedProminent)
                }
            } else {
                pendingPitchFooter
            }
        }
        .modifier(SurfaceCard())
        .shadow(color: Color.black.opacity(0.08), radius: 18, y: 6)
        .gesture(
            DragGesture(minimumDistance: 50)
                .onEnded { value in
                    if value.translation.width < -50 && abs(value.translation.height) < 50 {
                        handleUndo()
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    }
                }
        )
    }

    private var pendingPitchFooter: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Confirm Pitch")
                        .font(.headline)
                    Text(chartingState.pendingPitchSummary)
                        .font(.subheadline.bold())
                        .foregroundStyle(chartingState.isPendingPitchReady ? .primary : .secondary)
                        .lineLimit(2)
                    Text(canConfirmPitch ? "Tap confirm to save this pitch." : confirmBlockedReason)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 12)

                VeloInputWidget(velocity: $chartingState.pendingVelocity)

                HStack(spacing: 12) {
                    Button("Clear", action: chartingState.clearPitchDraft)
                        .buttonStyle(.bordered)
                        .disabled(
                            chartingState.selectedPitchType == nil
                                && chartingState.selectedLocation == nil
                                && chartingState.selectedPitchResult == nil
                        )

                    Button("Undo", systemImage: "arrow.uturn.backward", action: handleUndo)
                        .buttonStyle(.bordered)
                        .disabled(historyEntries.isEmpty)

                    Button("Confirm Pitch", systemImage: "checkmark.circle.fill", action: confirmPitch)
                        .controlSize(.large)
                        .buttonStyle(.borderedProminent)
                        .disabled(!canConfirmPitch)
                }
            }
        }
    }

    private var confirmBlockedReason: String {
        if !canUsePitchControls {
            return pitchControlBlockedReason ?? "Set the charting context before confirming pitches."
        }
        if needsPAClosure {
            return paGuidanceText
        }
        return "Select a pitch type, zone, and action before confirming."
    }

    private func confirmPitch() {
        if isLiveABMode {
            _ = chartingState.commitLiveABPitch()
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            return
        }

        guard let type = chartingState.selectedPitchType,
              let result = chartingState.selectedPitchResult else {
            return
        }

        let didRecord = gameStore.recordPitch(
            type: type,
            location: chartingState.selectedLocation,
            result: result,
            buntContext: chartingState.isBuntModeActive || result == .buntFoul,
            velocity: chartingState.pendingVelocity,
            lineupSlotOverride: chartingState.gameLineupOverrideSlot,
            hitterNameOverride: chartingState.resolvedGameHitterOverrideName
        )

        if didRecord {
            chartingState.clearPitchDraft()
            chartingState.clearGameCorrection()
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        }
    }

    private func closePlateAppearance(_ result: PAResultType) {
        if isLiveABMode {
            if chartingState.closeLiveAB(result: result) {
                isShowingPACloseoutSheet = false
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            }
            return
        }
        chartingState.clearPitchDraft()
        gameStore.closePlateAppearance(result: result)
        isShowingPACloseoutSheet = false
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    private func handleUndo() {
        if isLiveABMode {
            chartingState.undoLiveABAction()
        } else {
            gameStore.undoLastAction()
        }
    }

    private func presentHistory() {
        chartingState.isShowingHistory = true
    }

    private func presentPACloseout() {
        isShowingPACloseoutSheet = true
    }

    private func presentLiveABSetup() {
        chartingState.isShowingLiveABSetup = true
    }

    private func presentGameCorrection() {
        chartingState.isShowingGameCorrection = true
    }

    private func updateOrientationRequirement(for size: CGSize) {
        let shouldRequireLandscape = size.height > size.width
        guard shouldRequireLandscape != requiresLandscapeOrientation else {
            return
        }

        withAnimation(.easeInOut(duration: 0.2)) {
            requiresLandscapeOrientation = shouldRequireLandscape
        }
    }

    private func selectPitcher(_ pitcher: PersistedBootstrapPitcher) {
        if isLiveABMode {
            chartingState.setLiveABPitcher(
                playerId: pitcher.playerId,
                name: pitcher.name,
                throwsHand: pitcher.throwsHand
            )
            return
        }

        guard canEditGameMatchup, let gameId = gameStore.activeGame?.id else {
            return
        }

        Task {
            do {
                try await gameStore.addSegment(
                    gameId: gameId,
                    playerId: pitcher.playerId,
                    displayName: pitcher.name
                )
            } catch {
                gameStore.errorMessage = gameStore.apiClient.userFacingErrorMessage(for: error)
            }
        }
    }

    private func selectLineupHitter(_ entry: PersistedLineupEntry) {
        if isLiveABMode {
            chartingState.setLiveABHitter(name: entry.hitterName)
            return
        }

        guard canEditGameMatchup else {
            return
        }
        chartingState.applyGameCorrection(slot: entry.lineupSlot, hitterName: entry.hitterName)
    }

    private func selectRosterHitter(_ player: BootstrapRosterPlayer) {
        if isLiveABMode {
            chartingState.setLiveABHitter(name: player.name)
            return
        }

        guard canEditGameMatchup else {
            return
        }
        chartingState.applyGameCorrection(
            slot: chartingState.gameLineupOverrideSlot ?? gameStore.currentBatterSlot,
            hitterName: player.name
        )
    }
}

private struct SurfaceCard: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .background(.thinMaterial)
//            .background(Color(white: 1.0, opacity: 0.85)) // Alternative fallback
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(Color.white.opacity(0.6), lineWidth: 1.5)
            )
            .shadow(color: Color.black.opacity(0.08), radius: 18, y: 6)
    }
}

private struct LandscapeOrientationRequiredOverlay: View {
    var body: some View {
        ZStack {
            Rectangle()
                .fill(.ultraThinMaterial)
                .ignoresSafeArea()

            VStack(spacing: 18) {
                ZStack {
                    Circle()
                        .fill(Color.blue.opacity(0.14))
                        .frame(width: 96, height: 96)

                    Image(systemName: "rotate.right.fill")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(.blue)
                }

                VStack(spacing: 8) {
                    Text("Rotate to Landscape")
                        .font(.system(.title2, design: .rounded).weight(.bold))

                    Text("Live Charting is landscape-only. Turn the iPad sideways to continue.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 360)
                }

                Label("Charting controls are disabled in portrait.", systemImage: "lock.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.orange)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.orange.opacity(0.12))
                    .clipShape(Capsule())
            }
            .padding(32)
        }
    }
}

private struct InnerDeck: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(12)
            .background(Color.white.opacity(0.8))
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Color.black.opacity(0.04), lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct CompactDeck: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.white.opacity(0.8))
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Color.black.opacity(0.04), lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct MetricPill: View {
    let title: String
    let value: String
    let accent: Color
    let showsDisclosure: Bool

    init(title: String, value: String, accent: Color = .primary, showsDisclosure: Bool = false) {
        self.title = title
        self.value = value
        self.accent = accent
        self.showsDisclosure = showsDisclosure
    }

    var body: some View {
        HStack(spacing: 8) {
            Text(title)
                .font(.caption.bold())
                .foregroundStyle(.secondary)

            Text(value)
                .font(.subheadline.bold())
                .foregroundStyle(accent)
                .lineLimit(1)
                .minimumScaleFactor(0.9)

            if showsDisclosure {
                Image(systemName: "chevron.down")
                    .font(.caption2.bold())
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(accent.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct CountBadge: View {
    let title: String
    let balls: Int
    let strikes: Int
    let preset: LiveABCountPreset?
    let canEditPreset: Bool
    let onSelectPreset: ((LiveABCountPreset) -> Void)?

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)

                if let preset {
                    if let onSelectPreset {
                        Menu {
                            ForEach(LiveABCountPreset.allCases) { option in
                                Button {
                                    onSelectPreset(option)
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(option.rawValue)
                                            Text(option.detailText)
                                                .font(.caption)
                                        }
                                        if option == preset {
                                            Spacer()
                                            Image(systemName: "checkmark")
                                        }
                                    }
                                }
                            }
                        } label: {
                            HStack(spacing: 6) {
                                Text("Preset \(preset.rawValue)")
                                Spacer(minLength: 4)
                                Image(systemName: "chevron.down")
                                    .font(.caption2.bold())
                            }
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(canEditPreset ? .blue : .secondary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 4)
                            .frame(minWidth: 100)
                            .background(Color.blue.opacity(canEditPreset ? 0.12 : 0.07))
                            .clipShape(Capsule())
                        }
                        .disabled(!canEditPreset)
                    }
                } else {
                    Text("Balls-Strikes")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer(minLength: 0)

            Text("\(balls)-\(strikes)")
                .font(.system(size: 32, weight: .bold, design: .monospaced))
                .foregroundStyle(.blue)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color.white.opacity(0.85))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct MatchupSelectorLabel: View {
    let title: String
    let value: String
    let subtitle: String?
    let isPlaceholder: Bool
    let isEnabled: Bool

    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)

                Text(value)
                    .font(.subheadline.bold())
                    .foregroundStyle(isPlaceholder ? .secondary : .primary)
                    .lineLimit(1)

                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 6)

            Image(systemName: "chevron.down")
                .font(.caption.bold())
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.white.opacity(isEnabled ? 0.92 : 0.65))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .opacity(isEnabled ? 1 : 0.72)
    }
}

struct VeloInputWidget: View {
    @Binding var velocity: Int?
    @State private var isShowingNumpad = false

    var body: some View {
        VStack(alignment: .center, spacing: 4) {
            Text("Velo")
                .font(.caption.bold())
                .foregroundStyle(.secondary)

            HStack(spacing: 6) {
                Button {
                    if let v = velocity, v > 1 {
                        velocity = v - 1
                    }
                } label: {
                    Image(systemName: "minus")
                        .font(.caption.bold())
                        .frame(width: 28, height: 28)
                        .background(Color.white.opacity(0.8))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(velocity == nil)

                Button {
                    isShowingNumpad = true
                } label: {
                    Text(velocity.map { "\($0)" } ?? "—")
                        .font(.system(.title3, design: .monospaced).bold())
                        .foregroundStyle(velocity == nil ? .secondary : .primary)
                        .frame(minWidth: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Button {
                    velocity = (velocity ?? 59) + 1
                } label: {
                    Image(systemName: "plus")
                        .font(.caption.bold())
                        .frame(width: 28, height: 28)
                        .background(Color.white.opacity(0.8))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }

            Text("mph")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Color.white.opacity(0.72))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .popover(isPresented: $isShowingNumpad, arrowEdge: .bottom) {
            VeloNumpadPopover(velocity: $velocity, isPresented: $isShowingNumpad)
                .presentationCompactAdaptation(.popover)
        }
    }
}

private struct VeloNumpadPopover: View {
    @Binding var velocity: Int?
    @Binding var isPresented: Bool

    @State private var inputString: String = ""

    private let rows: [[String]] = [
        ["7", "8", "9"],
        ["4", "5", "6"],
        ["1", "2", "3"],
        ["C", "0", "⌫"],
    ]

    var body: some View {
        VStack(spacing: 16) {
            Text("Velocity")
                .font(.headline)

            HStack(alignment: .lastTextBaseline, spacing: 4) {
                Text(inputString.isEmpty ? "—" : inputString)
                    .font(.system(size: 52, weight: .bold, design: .monospaced))
                    .frame(minWidth: 100, alignment: .trailing)
                    .foregroundStyle(inputString.isEmpty ? .secondary : .primary)
                Text("mph")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 10) {
                ForEach(rows, id: \.self) { row in
                    HStack(spacing: 10) {
                        ForEach(row, id: \.self) { key in
                            numpadKey(key)
                        }
                    }
                }
            }

            HStack(spacing: 12) {
                Button("Cancel") {
                    isPresented = false
                }
                .buttonStyle(.bordered)

                Spacer(minLength: 0)

                Button("Done") {
                    if let value = Int(inputString), value > 0 {
                        velocity = value
                    } else if inputString.isEmpty {
                        velocity = nil
                    }
                    isPresented = false
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(width: 290)
        .onAppear {
            inputString = velocity.map { "\($0)" } ?? ""
        }
    }

    @ViewBuilder
    private func numpadKey(_ key: String) -> some View {
        let isClear = key == "C"
        Button {
            handleKey(key)
        } label: {
            Text(key)
                .font(.title2.bold())
                .frame(width: 74, height: 58)
                .background(isClear ? Color.red.opacity(0.14) : Color(white: 0.94))
                .foregroundStyle(isClear ? .red : .primary)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func handleKey(_ key: String) {
        switch key {
        case "C":
            inputString = ""
        case "⌫":
            if !inputString.isEmpty { inputString.removeLast() }
        default:
            if inputString.count < 3 { inputString += key }
        }
    }
}

struct TopBarActionButton: View {
    let title: String
    let systemImage: String
    let accent: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .foregroundStyle(accent == .secondary ? .primary : accent)
                .background((accent == .secondary ? Color.white : accent.opacity(0.1)))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

private struct LiveABSetupSheet: View {
    let pitchers: [PersistedBootstrapPitcher]
    let rosterPlayers: [BootstrapRosterPlayer]
    let initialSetup: LiveABSetup
    let onStart: (LiveABSetup) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var setup: LiveABSetup
    @State private var isShowingHitterPicker = false

    init(
        pitchers: [PersistedBootstrapPitcher],
        rosterPlayers: [BootstrapRosterPlayer],
        initialSetup: LiveABSetup,
        onStart: @escaping (LiveABSetup) -> Void
    ) {
        self.pitchers = pitchers
        self.rosterPlayers = rosterPlayers
        self.initialSetup = initialSetup
        self.onStart = onStart
        _setup = State(initialValue: initialSetup)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Matchup") {
                    Picker("Pitcher", selection: $setup.pitcherPlayerId) {
                        Text("Select Pitcher").tag("")
                        ForEach(pitchers, id: \.playerId) { pitcher in
                            Text("\(pitcher.name) (\(pitcher.throwsHand == "L" ? "LHP" : "RHP"))")
                                .tag(pitcher.playerId)
                        }
                    }
                    .onChange(of: setup.pitcherPlayerId) { _, newValue in
                        guard let pitcher = pitchers.first(where: { $0.playerId == newValue }) else {
                            return
                        }
                        setup.pitcherName = pitcher.name
                        setup.pitcherThrowsHand = pitcher.throwsHand
                    }

                    Button {
                        isShowingHitterPicker = true
                    } label: {
                        HStack {
                            Text("Babson Hitter")
                            Spacer()
                            Text(setup.hitterName.isEmpty ? "Choose from roster" : setup.hitterName)
                                .foregroundStyle(setup.hitterName.isEmpty ? .secondary : .primary)
                                .lineLimit(1)
                        }
                    }
                    .disabled(rosterPlayers.isEmpty)

                    if let selectedPlayer = rosterPlayers.first(where: { $0.name == setup.hitterName }) {
                        Text(selectedPlayer.positions.joined(separator: " / "))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else if rosterPlayers.isEmpty {
                        Text("No Babson roster loaded yet. Refresh bootstrap from Settings to import hitters.")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }

                    TextField("Or enter manual hitter", text: $setup.hitterName)
                        .textInputAutocapitalization(.words)
                }

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

                Section("Count Preset") {
                    Picker("Default Count", selection: $setup.countPreset) {
                        ForEach(LiveABCountPreset.allCases) { preset in
                            Text(preset.rawValue).tag(preset)
                        }
                    }
                    .pickerStyle(.segmented)

                    Text(setup.countPreset.detailText)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Start Live AB")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $isShowingHitterPicker) {
                LiveABRosterPickerSheet(
                    title: "Select Hitter",
                    players: rosterPlayers
                ) { player in
                    setup.hitterName = player.name
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Start") {
                        onStart(setup)
                        dismiss()
                    }
                    .disabled(!setup.isReady)
                }
            }
        }
    }
}

private struct GameCorrectionSheet: View {
    let lineup: [PersistedLineupEntry]
    let rosterPlayers: [BootstrapRosterPlayer]
    let initialSlot: Int
    let initialHitterName: String
    let onSave: (Int, String?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedSlot: Int
    @State private var hitterName: String
    @State private var isShowingHitterPicker = false

    init(
        lineup: [PersistedLineupEntry],
        rosterPlayers: [BootstrapRosterPlayer],
        initialSlot: Int,
        initialHitterName: String,
        onSave: @escaping (Int, String?) -> Void
    ) {
        self.lineup = lineup
        self.rosterPlayers = rosterPlayers
        self.initialSlot = initialSlot
        self.initialHitterName = initialHitterName
        self.onSave = onSave
        _selectedSlot = State(initialValue: initialSlot)
        _hitterName = State(initialValue: initialHitterName)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Next Hitter") {
                    Picker("Lineup Slot", selection: $selectedSlot) {
                        ForEach(1...9, id: \.self) { slot in
                            Text("#\(slot)").tag(slot)
                        }
                    }
                    .onChange(of: selectedSlot) { _, newValue in
                        if let lineupName = lineup.first(where: { $0.lineupSlot == newValue })?.hitterName {
                            hitterName = lineupName
                        }
                    }

                    Button {
                        isShowingHitterPicker = true
                    } label: {
                        HStack {
                            Text("Babson Roster")
                            Spacer()
                            Text(hitterName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Choose hitter" : hitterName)
                                .foregroundStyle(hitterName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .secondary : .primary)
                                .lineLimit(1)
                        }
                    }
                    .disabled(rosterPlayers.isEmpty)

                    TextField("Hitter Name", text: $hitterName)
                        .textInputAutocapitalization(.words)
                }
            }
            .navigationTitle("Correct Next AB")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $isShowingHitterPicker) {
                LiveABRosterPickerSheet(
                    title: "Select Hitter",
                    players: rosterPlayers
                ) { player in
                    hitterName = player.name
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let trimmed = hitterName.trimmingCharacters(in: .whitespacesAndNewlines)
                        onSave(selectedSlot, trimmed.isEmpty ? nil : trimmed)
                        dismiss()
                    }
                }
            }
        }
    }
}

struct LiveABRosterPickerSheet: View {
    let title: String
    let players: [BootstrapRosterPlayer]
    let onSelect: (BootstrapRosterPlayer) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""

    private var filteredPlayers: [BootstrapRosterPlayer] {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return players
        }

        return players.filter { player in
            player.name.localizedCaseInsensitiveContains(trimmed)
                || player.positions.joined(separator: " ").localizedCaseInsensitiveContains(trimmed)
                || (player.academicYear?.localizedCaseInsensitiveContains(trimmed) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            List(filteredPlayers) { player in
                Button {
                    onSelect(player)
                    dismiss()
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(player.name)
                            .foregroundStyle(.primary)

                        HStack(spacing: 8) {
                            if !player.positions.isEmpty {
                                Text(player.positions.joined(separator: " / "))
                            }
                            if let academicYear = player.academicYear, !academicYear.isEmpty {
                                Text(academicYear)
                            }
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                }
                .tint(.primary)
            }
            .searchable(text: $searchText, prompt: "Search roster")
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}
