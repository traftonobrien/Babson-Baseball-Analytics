import SwiftUI
import SwiftData

/// The main touch interface for logging pitches.
struct LiveChartingView: View {
    @Bindable var gameStore: GameStore
    @State private var chartingState = ChartingState()
    @Environment(\.dismiss) private var dismiss
    private let layoutSpacing: CGFloat = 16
    
    var body: some View {
        GeometryReader { proxy in
            let contentWidth = proxy.size.width - 32
            let bottomDockHeight = min(max(proxy.size.height * 0.34, 280), 340)
            
            VStack(spacing: layoutSpacing) {
                zoneSelectionPanel
                    .frame(maxWidth: .infinity)
                    .frame(maxHeight: .infinity)
                
                bottomDock(totalWidth: contentWidth)
                    .frame(height: bottomDockHeight)
            }
            .padding(16)
        }
        .navigationTitle("Live Charting")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Exit") { dismiss() }
            }
        }
        .navigationBarBackButtonHidden()
    }
    
    private var currentHitter: String {
        gameStore.activeLineup.first { $0.lineupSlot == gameStore.currentBatterSlot }?.hitterName ?? "Unknown Hitter"
    }
    
    private var currentPitcher: String {
        gameStore.activeSegments.last?.displayName ?? "Unknown Pitcher"
    }
    
    private var currentPitcherThrows: String {
        gameStore.pitchers.first(where: { $0.playerId == gameStore.activeSegments.last?.playerId })?.throwsHand ?? "R"
    }
    
    private var activePitchesForCurrentPA: [PersistedPitch] {
        let currentPAId = gameStore.liveState.openPAId ?? gameStore.activePlateAppearances.last?.id
        return gameStore.activePitches.filter { $0.paId == currentPAId }
    }
    
    private var zoneSelectionPanel: some View {
        VStack(spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Zone Selection")
                        .font(.headline)
                    Text("The top canvas is for location only. Use the dock below for count, pitch type, pitch result, and PA finish.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                Text(chartingState.selectedLocation.map { "Cell \($0)" } ?? "No cell selected")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(chartingState.selectedLocation == nil ? Color.secondary : Color.blue)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.blue.opacity(chartingState.selectedLocation == nil ? 0.08 : 0.14))
                    .clipShape(Capsule())
            }
            
            ZoneGridView(state: chartingState)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .padding(16)
        .background(Color(white: 0.98))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
    
    private var matchupAndHistoryPanel: some View {
        VStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Matchup")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Spacer()
                    SyncStatusIndicator(status: gameStore.syncStatus)
                }
                
                Text("P: \(currentPitcher) (\(currentPitcherThrows == "L" ? "LHP" : "RHP"))")
                    .font(.headline)
                Text("H: \(currentHitter) (#\(gameStore.currentBatterSlot))")
                    .font(.headline)
                if let errorMessage = gameStore.errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .modifier(ControlCard())
            
            PitchHistoryList(
                activePitches: activePitchesForCurrentPA,
                onUndo: { gameStore.undoLastAction() }
            )
            .frame(maxHeight: .infinity)
            .modifier(ControlCard())
        }
    }
    
    private var liveCountCard: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Live Count")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(gameStore.isTopInning ? "Top \(gameStore.currentInning)" : "Bot \(gameStore.currentInning)")
                    .font(.headline)
                Text("\(gameStore.currentOuts) Outs")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(gameStore.liveState.guidanceText)
                    .font(.caption)
                    .foregroundStyle(gameStore.liveState.needsPAClosure ? .orange : .secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            
            Spacer()
            
            Text("\(gameStore.currentBalls)-\(gameStore.currentStrikes)")
                .font(.system(size: 52, weight: .bold, design: .monospaced))
                .foregroundStyle(.blue)
        }
        .modifier(ControlCard())
    }
    
    private var pitchTypeCard: some View {
        PitchTypePicker(state: chartingState)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .modifier(ControlCard())
    }
    
    private var resultCard: some View {
        PitchResultControls(
            state: chartingState,
            canRecordPitch: !gameStore.liveState.needsPAClosure,
            blockedReason: gameStore.liveState.needsPAClosure ? gameStore.liveState.guidanceText : nil
        ) { type, loc, result, bunt in
            gameStore.recordPitch(type: type, location: loc, result: result, buntContext: bunt)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .modifier(ControlCard())
    }
    
    private var closePACard: some View {
        PAResultControls(
            availableResults: gameStore.liveState.availableResults,
            statusMessage: gameStore.liveState.guidanceText,
            submitResult: { result in
                chartingState.resetForm()
                gameStore.closePlateAppearance(result: result)
            }
        )
        .modifier(ControlCard())
    }
    
    private func bottomDock(totalWidth: CGFloat) -> some View {
        let leftRailWidth = min(max(totalWidth * 0.27, 250), 320)
        let workingWidth = totalWidth - leftRailWidth - layoutSpacing * 2
        let columnWidth = max(workingWidth / 2, 260)
        
        return VStack(spacing: 16) {
            HStack(alignment: .top, spacing: layoutSpacing) {
                matchupAndHistoryPanel
                    .frame(width: leftRailWidth)
                
                VStack(spacing: layoutSpacing) {
                    liveCountCard
                    pitchTypeCard
                }
                .frame(width: columnWidth)
                
                VStack(spacing: layoutSpacing) {
                    resultCard
                    closePACard
                }
                .frame(width: columnWidth)
            }
        }
    }
}

private struct ControlCard: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .background(Color(white: 0.95))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}
