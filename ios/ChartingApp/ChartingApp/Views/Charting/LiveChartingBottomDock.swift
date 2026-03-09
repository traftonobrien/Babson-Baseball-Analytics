import SwiftUI
import SwiftData
import UIKit

struct LiveChartingBottomDock: View {
    @Bindable var gameStore: GameStore
    @Bindable var chartingState: ChartingState
    
    let pitchControlBlockedReason: String?
    let isUndoDisabled: Bool
    
    let presentPACloseout: () -> Void
    let handleUndo: () -> Void
    
    private var isLiveABMode: Bool { chartingState.mode == .liveAB }
    
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
    
    private var canUsePitchControls: Bool {
        if isLiveABMode {
            return chartingState.currentLiveABSession != nil
        }
        return gameStore.activeSegments.last != nil
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
    
    private var confirmBlockedReason: String {
        if !canUsePitchControls {
            return pitchControlBlockedReason ?? "Set the charting context before confirming pitches."
        }
        if needsPAClosure {
            return paGuidanceText
        }
        return "Select a pitch type, zone, and action before confirming."
    }
    
    var body: some View {
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
        .padding(16)
        // Glassmorphic styling for the bottom dock
        .background(.ultraThinMaterial)
        .background(Color(white: 1.0, opacity: 0.85))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(Color.white.layer(opacity: 0.6), lineWidth: 1.5)
        )
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
                        .disabled(isUndoDisabled)

                    Button("Confirm Pitch", systemImage: "checkmark.circle.fill", action: confirmPitch)
                        .controlSize(.large)
                        .buttonStyle(.borderedProminent)
                        .disabled(!canConfirmPitch)
                }
            }
        }
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
}

extension Color {
    func layer(opacity: Double) -> Color {
        self.opacity(opacity)
    }
}
