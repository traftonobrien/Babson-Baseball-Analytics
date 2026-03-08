import SwiftUI

struct PACloseoutSheet: View {
    let availableResults: [PAResultType]
    let statusMessage: String
    let submitResult: (PAResultType) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var selectedPrimary: PAOutcomePrimaryChoice?
    @State private var selectedBranch: PAOutcomeBranch?
    @State private var selectedOutPath: PAOutPath?
    @State private var selectedSafePath: PASafePath?
    @State private var selectedResult: PAResultType?

    private let primaryColumns = [GridItem(.adaptive(minimum: 140), spacing: 12)]
    private let detailColumns = [GridItem(.adaptive(minimum: 150), spacing: 12)]
    private let scoringColumns = [GridItem(.adaptive(minimum: 126), spacing: 12)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Build the complete plate appearance result before saving it.")
                            .font(.headline)
                        Text(statusMessage)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(20)
                    .background(Color(white: 0.97))
                    .clipShape(RoundedRectangle(cornerRadius: 22))

                    progressCard

                    if showsPrimarySelection {
                        stepSection(title: "Outcome") {
                            LazyVGrid(columns: primaryColumns, spacing: 12) {
                                ForEach(primaryChoices) { choice in
                                    selectionButton(
                                        title: choice.title,
                                        subtitle: choice.subtitle,
                                        isSelected: effectivePrimary == choice,
                                        tint: choice.tint
                                    ) {
                                        selectPrimary(choice)
                                    }
                                }
                            }
                        }
                    }

                    if effectivePrimary == .ballInPlay {
                        stepSection(title: "Ball In Play Outcome") {
                            LazyVGrid(columns: detailColumns, spacing: 12) {
                                ForEach(branchChoices) { branch in
                                    selectionButton(
                                        title: branch.title,
                                        subtitle: branch.subtitle,
                                        isSelected: selectedBranch == branch,
                                        tint: branch.tint
                                    ) {
                                        selectBranch(branch)
                                    }
                                }
                            }
                        }
                    }

                    if shouldShowSafePathStep {
                        stepSection(title: "Reached Safely On") {
                            LazyVGrid(columns: detailColumns, spacing: 12) {
                                ForEach(safePathChoices) { path in
                                    selectionButton(
                                        title: path.title,
                                        subtitle: path.subtitle,
                                        isSelected: selectedSafePath == path,
                                        tint: path.tint
                                    ) {
                                        selectSafePath(path)
                                    }
                                }
                            }
                        }
                    }

                    if shouldShowOutPathStep {
                        stepSection(title: "Out Type") {
                            LazyVGrid(columns: detailColumns, spacing: 12) {
                                ForEach(outPathChoices) { path in
                                    selectionButton(
                                        title: path.title,
                                        subtitle: path.subtitle,
                                        isSelected: selectedOutPath == path,
                                        tint: path.tint
                                    ) {
                                        selectOutPath(path)
                                    }
                                }
                            }
                        }
                    }

                    if !resultChoices.isEmpty {
                        stepSection(title: resultStepTitle) {
                            LazyVGrid(columns: scoringColumns, spacing: 12) {
                                ForEach(resultChoices) { result in
                                    resultSelectionButton(result)
                                }
                            }
                        }
                    }

                    selectionReviewCard
                }
                .padding(24)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(Color(.systemBackground))
            .safeAreaInset(edge: .bottom, spacing: 0) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        Text(selectedResult == nil ? "Closeout Progress" : "Ready To Save")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)

                        Spacer(minLength: 0)

                        if let selectedResult {
                            Text(selectedResult.rawValue)
                                .font(.subheadline.bold())
                                .foregroundStyle(.primary)
                        }
                    }

                    Text(progressPrompt)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)

                    HStack(spacing: 12) {
                        Button("Cancel") {
                            dismiss()
                        }
                        .buttonStyle(.bordered)

                        Spacer(minLength: 0)

                        Button("Save PA Result", action: submitSelection)
                            .buttonStyle(.borderedProminent)
                            .disabled(selectedResult == nil)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 12)
                .padding(.bottom, 16)
                .background(.regularMaterial)
            }
            .navigationTitle("Close Plate Appearance")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .onAppear(perform: seedDefaults)
    }

    private var progressCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Progress")
                .font(.headline)

            HStack(spacing: 10) {
                ForEach(progressSteps) { step in
                    ProgressChip(step: step)
                }
            }

            if selectionTrail.isEmpty {
                Text(progressPrompt)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(selectionTrail, id: \.self) { item in
                            Text(item)
                                .font(.caption.bold())
                                .padding(.horizontal, 10)
                                .padding(.vertical, 7)
                                .background(Color.white)
                                .clipShape(Capsule())
                        }
                    }
                }
            }
        }
        .padding(18)
        .background(Color(white: 0.97))
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    private var selectionReviewCard: some View {
        Group {
            if let selectedResult {
                selectedResultSummary(result: selectedResult)
            } else {
                HStack(spacing: 10) {
                    Image(systemName: "square.and.pencil")
                        .foregroundStyle(.secondary)
                    Text(progressPrompt)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(18)
                .background(Color.gray.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 18))
            }
        }
    }

    private var primaryChoices: [PAOutcomePrimaryChoice] {
        var choices: [PAOutcomePrimaryChoice] = []

        if availableResults.contains(where: { [.hit, .out, .misc].contains($0.family) }) {
            choices.append(.ballInPlay)
        }
        if availableResults.contains(.strikeout) {
            choices.append(.strikeout)
        }
        if availableResults.contains(.walk) {
            choices.append(.walk)
        }
        if availableResults.contains(.hitByPitch) {
            choices.append(.hitByPitch)
        }

        return choices
    }

    private var effectivePrimary: PAOutcomePrimaryChoice? {
        showsPrimarySelection ? selectedPrimary : primaryChoices.first
    }

    private var showsPrimarySelection: Bool {
        primaryChoices.count > 1
    }

    private var branchChoices: [PAOutcomeBranch] {
        var branches: [PAOutcomeBranch] = []

        if availableResults.contains(where: { $0.family == .hit }) {
            branches.append(.hit)
        }
        if availableResults.contains(where: { $0.family == .out }) {
            branches.append(.out)
        }
        if availableResults.contains(where: { $0.family == .misc }) {
            branches.append(.reachedSafely)
        }

        return branches
    }

    private var safePathChoices: [PASafePath] {
        var paths: [PASafePath] = []

        if availableResults.contains(where: \.isError) {
            paths.append(.error)
        }
        if availableResults.contains(where: \.isFieldersChoice) {
            paths.append(.fieldersChoice)
        }

        return paths
    }

    private var outPathChoices: [PAOutPath] {
        var paths: [PAOutPath] = []

        if availableResults.contains(where: \.isFlyOut) {
            paths.append(.flyOut)
        }
        if availableResults.contains(where: \.isLineOut) {
            paths.append(.lineOut)
        }
        if availableResults.contains(where: \.isPopOut) {
            paths.append(.popOut)
        }
        if availableResults.contains(where: \.isGroundOut) {
            paths.append(.groundOut)
        }
        if availableResults.contains(where: \.isUnassistedOut) {
            paths.append(.unassistedOut)
        }
        if availableResults.contains(where: \.isDoublePlay) {
            paths.append(.doublePlay)
        }

        return paths
    }

    private var shouldShowSafePathStep: Bool {
        effectivePrimary == .ballInPlay && selectedBranch == .reachedSafely && !safePathChoices.isEmpty
    }

    private var shouldShowOutPathStep: Bool {
        effectivePrimary == .ballInPlay && selectedBranch == .out && !outPathChoices.isEmpty
    }

    private var resultChoices: [PAResultType] {
        switch effectivePrimary {
        case .strikeout:
            return orderedAvailable([.strikeout])
        case .walk:
            return orderedAvailable([.walk])
        case .hitByPitch:
            return orderedAvailable([.hitByPitch])
        case .ballInPlay:
            switch selectedBranch {
            case .hit:
                return orderedAvailable(PAResultType.hitOptions)
            case .out:
                switch selectedOutPath {
                case .flyOut:
                    return orderedAvailable(PAResultType.flyOutOptions)
                case .lineOut:
                    return orderedAvailable(PAResultType.lineOutOptions)
                case .popOut:
                    return orderedAvailable(PAResultType.popOutOptions)
                case .groundOut:
                    return orderedAvailable(PAResultType.groundOutOptions)
                case .unassistedOut:
                    return orderedAvailable(PAResultType.unassistedOutOptions)
                case .doublePlay:
                    return orderedAvailable(PAResultType.doublePlayOptions)
                case .none:
                    return []
                }
            case .reachedSafely:
                switch selectedSafePath {
                case .error:
                    return orderedAvailable(PAResultType.errorOptions)
                case .fieldersChoice:
                    return orderedAvailable(PAResultType.fieldersChoiceOptions)
                case .none:
                    return []
                }
            case .none:
                return []
            }
        case .none:
            return []
        }
    }

    private var resultStepTitle: String {
        switch effectivePrimary {
        case .strikeout, .walk, .hitByPitch:
            return "Confirm Result"
        case .ballInPlay:
            switch selectedBranch {
            case .hit:
                return "Hit Type"
            case .out, .reachedSafely:
                return "Scoring"
            case .none:
                return "Scoring"
            }
        case .none:
            return "Scoring"
        }
    }

    private var detailStepComplete: Bool {
        guard let primary = effectivePrimary else {
            return false
        }

        guard primary == .ballInPlay else {
            return true
        }

        switch selectedBranch {
        case .hit:
            return true
        case .out:
            return selectedOutPath != nil
        case .reachedSafely:
            return selectedSafePath != nil
        case .none:
            return false
        }
    }

    private var progressSteps: [CloseoutProgressStep] {
        [
            CloseoutProgressStep(
                title: "Outcome",
                isComplete: effectivePrimary != nil,
                isCurrent: effectivePrimary == nil
            ),
            CloseoutProgressStep(
                title: "Detail",
                isComplete: detailStepComplete,
                isCurrent: effectivePrimary != nil && !detailStepComplete
            ),
            CloseoutProgressStep(
                title: "Scoring",
                isComplete: selectedResult != nil,
                isCurrent: resultChoices.count > 0 && selectedResult == nil
            ),
        ]
    }

    private var selectionTrail: [String] {
        var trail: [String] = []

        if let primary = effectivePrimary {
            trail.append(primary.title)
        }
        if let branch = selectedBranch {
            trail.append(branch.title)
        }
        if let safePath = selectedSafePath {
            trail.append(safePath.title)
        }
        if let outPath = selectedOutPath {
            trail.append(outPath.title)
        }
        if let selectedResult {
            trail.append(selectedResult.rawValue)
        }

        return trail
    }

    private var progressPrompt: String {
        if let selectedResult {
            return "Save \(selectedResult.rawValue) to close the plate appearance."
        }

        guard let primary = effectivePrimary else {
            return "Choose the plate appearance outcome first."
        }

        guard primary == .ballInPlay else {
            return "Confirm the result, then save the plate appearance."
        }

        switch selectedBranch {
        case .none:
            return "Choose how the ball in play ended."
        case .hit:
            return "Choose the hit type to finish the play."
        case .out:
            return selectedOutPath == nil ? "Choose the out type before scoring it." : "Choose the scored out result."
        case .reachedSafely:
            return selectedSafePath == nil ? "Choose how the batter reached safely." : "Choose the scored safe result."
        }
    }

    private func orderedAvailable(_ options: [PAResultType]) -> [PAResultType] {
        let available = Set(availableResults)
        return options.filter { available.contains($0) }
    }

    private func seedDefaults() {
        guard selectedPrimary == nil else {
            return
        }

        if let primary = primaryChoices.first, !showsPrimarySelection {
            selectPrimary(primary)
        }
    }

    private func selectPrimary(_ choice: PAOutcomePrimaryChoice) {
        selectedPrimary = choice
        selectedBranch = nil
        selectedOutPath = nil
        selectedSafePath = nil
        selectedResult = nil

        let options = resultChoices
        if options.count == 1, let onlyResult = options.first {
            selectedResult = onlyResult
        }
    }

    private func selectBranch(_ branch: PAOutcomeBranch) {
        selectedBranch = branch
        selectedOutPath = nil
        selectedSafePath = nil
        selectedResult = nil

        let options = resultChoices
        if options.count == 1, let onlyResult = options.first {
            selectedResult = onlyResult
        }
    }

    private func selectOutPath(_ path: PAOutPath) {
        selectedOutPath = path
        selectedResult = nil

        let options = resultChoices
        if options.count == 1, let onlyResult = options.first {
            selectedResult = onlyResult
        }
    }

    private func selectSafePath(_ path: PASafePath) {
        selectedSafePath = path
        selectedResult = nil

        let options = resultChoices
        if options.count == 1, let onlyResult = options.first {
            selectedResult = onlyResult
        }
    }

    private func submitSelection() {
        guard let selectedResult else {
            return
        }

        submitResult(selectedResult)
        dismiss()
    }

    private func stepSection<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
            content()
        }
        .padding(18)
        .background(Color(white: 0.97))
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    private func selectedResultSummary(result: PAResultType) -> some View {
        HStack(spacing: 10) {
            Label("Selected", systemImage: "checkmark.circle.fill")
                .font(.caption.bold())
                .foregroundStyle(.green)
            Text(result.rawValue)
                .font(.headline.bold())
            Spacer(minLength: 0)
            Text(result.detailText)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(18)
        .background(Color.green.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }

    private func resultSelectionButton(_ result: PAResultType) -> some View {
        selectionButton(
            title: result.rawValue,
            subtitle: result.detailText,
            isSelected: selectedResult == result,
            tint: resultTint(for: result)
        ) {
            selectedResult = result
        }
    }

    private func resultTint(for result: PAResultType) -> Color {
        switch result.family {
        case .strikeout:
            return .red
        case .freePass:
            return result == .hitByPitch ? .purple : .green
        case .hit:
            return .blue
        case .out:
            return .orange
        case .misc:
            return .gray
        }
    }

    private func selectionButton(
        title: String,
        subtitle: String,
        isSelected: Bool,
        tint: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text(title)
                        .font(.headline.bold())
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.body.bold())
                    }
                }

                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(isSelected ? .white.opacity(0.9) : .secondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, minHeight: 88, alignment: .leading)
            .padding(14)
            .background(isSelected ? tint : tint.opacity(0.12))
            .foregroundStyle(isSelected ? .white : tint)
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .overlay {
                RoundedRectangle(cornerRadius: 18)
                    .stroke(tint.opacity(isSelected ? 0.95 : 0.2), lineWidth: isSelected ? 2 : 1)
            }
        }
        .buttonStyle(.plain)
    }
}

private enum PAOutcomePrimaryChoice: String, CaseIterable, Identifiable {
    case ballInPlay
    case strikeout
    case walk
    case hitByPitch

    var id: String { rawValue }

    var title: String {
        switch self {
        case .ballInPlay:
            return "Ball In Play"
        case .strikeout:
            return "K"
        case .walk:
            return "BB"
        case .hitByPitch:
            return "HBP"
        }
    }

    var subtitle: String {
        switch self {
        case .ballInPlay:
            return "Resolve the full scoring play"
        case .strikeout:
            return "Batter struck out"
        case .walk:
            return "Batter walked"
        case .hitByPitch:
            return "Batter awarded first"
        }
    }

    var tint: Color {
        switch self {
        case .ballInPlay:
            return .blue
        case .strikeout:
            return .red
        case .walk:
            return .green
        case .hitByPitch:
            return .purple
        }
    }
}

private enum PAOutcomeBranch: String, CaseIterable, Identifiable {
    case hit
    case out
    case reachedSafely

    var id: String { rawValue }

    var title: String {
        switch self {
        case .hit:
            return "Hit"
        case .out:
            return "Out"
        case .reachedSafely:
            return "Reached Safely"
        }
    }

    var subtitle: String {
        switch self {
        case .hit:
            return "Single, extra-base hit, or homer"
        case .out:
            return "Batter retired on the play"
        case .reachedSafely:
            return "Error or fielder's choice"
        }
    }

    var tint: Color {
        switch self {
        case .hit:
            return .blue
        case .out:
            return .orange
        case .reachedSafely:
            return .gray
        }
    }
}

private enum PASafePath: String, CaseIterable, Identifiable {
    case error
    case fieldersChoice

    var id: String { rawValue }

    var title: String {
        switch self {
        case .error:
            return "Error"
        case .fieldersChoice:
            return "Fielder's Choice"
        }
    }

    var subtitle: String {
        switch self {
        case .error:
            return "Reached because the defense misplayed it"
        case .fieldersChoice:
            return "Defense retired or tried for another runner"
        }
    }

    var tint: Color {
        .gray
    }
}

private enum PAOutPath: String, CaseIterable, Identifiable {
    case flyOut
    case lineOut
    case popOut
    case groundOut
    case unassistedOut
    case doublePlay

    var id: String { rawValue }

    var title: String {
        switch self {
        case .flyOut:
            return "Fly Out"
        case .lineOut:
            return "Line Out"
        case .popOut:
            return "Pop Out"
        case .groundOut:
            return "Ground Out"
        case .unassistedOut:
            return "Unassisted Out"
        case .doublePlay:
            return "Double Play"
        }
    }

    var subtitle: String {
        switch self {
        case .flyOut:
            return "Pick the fielder who made the catch"
        case .lineOut:
            return "Hard-hit out caught in the air"
        case .popOut:
            return "Infield or shallow pop out"
        case .groundOut:
            return "Batter retired at first"
        case .unassistedOut:
            return "Single defender records the out"
        case .doublePlay:
            return "Two outs on the play"
        }
    }

    var tint: Color {
        .orange
    }
}

private struct CloseoutProgressStep: Identifiable {
    let title: String
    let isComplete: Bool
    let isCurrent: Bool

    var id: String { title }
}

private struct ProgressChip: View {
    let step: CloseoutProgressStep

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: iconName)
                .font(.caption.bold())
            Text(step.title)
                .font(.caption.bold())
                .lineLimit(1)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .foregroundStyle(foregroundColor)
        .background(backgroundColor)
        .clipShape(Capsule())
    }

    private var iconName: String {
        if step.isComplete {
            return "checkmark.circle.fill"
        }
        if step.isCurrent {
            return "circle.fill"
        }
        return "circle"
    }

    private var foregroundColor: Color {
        if step.isComplete {
            return .green
        }
        if step.isCurrent {
            return .blue
        }
        return .secondary
    }

    private var backgroundColor: Color {
        if step.isComplete {
            return Color.green.opacity(0.12)
        }
        if step.isCurrent {
            return Color.blue.opacity(0.12)
        }
        return Color.white
    }
}
