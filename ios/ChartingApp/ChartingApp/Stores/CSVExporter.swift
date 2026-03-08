import Foundation

/// Generates pitch-level CSV data from the local SwiftData records for a
/// charted game. The output matches the column layout used by the web export
/// route so downstream tooling can consume either interchangeably.
enum CSVExporter {

    static let columns = [
        "game_id",
        "game_date",
        "opponent",
        "game_status",
        "revision",
        "charter",
        "weather",
        "home_catcher",
        "away_catcher",
        "babson_record",
        "standing",
        "tomorrow_starter",
        "tomorrow_opponent",
        "notes",
        "segment_id",
        "segment_order",
        "pitcher_player_id",
        "pitcher_name",
        "segment_entered_inning",
        "segment_exited_inning",
        "runs_override",
        "earned_runs_override",
        "pa_id",
        "pa_order",
        "inning",
        "hitter_name",
        "lineup_slot",
        "bunt_context",
        "pa_result_code",
        "pitch_id",
        "game_pitch_sequence",
        "pitch_number_in_pa",
        "pitch_order",
        "count_before",
        "balls_before",
        "strikes_before",
        "pitch_type",
        "location_cell",
        "pitch_result",
        "velocity",
    ]

    /// Build a complete CSV string (header + data rows) for a finished game.
    static func buildCSV(
        game: PersistedGame,
        segments: [PersistedSegment],
        plateAppearances: [PersistedPlateAppearance],
        pitches: [PersistedPitch]
    ) -> String {
        let segmentById = Dictionary(uniqueKeysWithValues: segments.map { ($0.id, $0) })
        let paById = Dictionary(uniqueKeysWithValues: plateAppearances.map { ($0.id, $0) })
        let pitchesByPaId = Dictionary(grouping: pitches) { $0.paId }

        // Build ordered entries: pitches grouped under their PAs in PA order,
        // then any orphan pitches (shouldn't happen, but handle gracefully).
        var entries: [(pitch: PersistedPitch, pitchNumInPA: Int?)] = []
        var seenPitchIds = Set<String>()

        let orderedPAs = plateAppearances.sorted { $0.paOrder < $1.paOrder }
        for pa in orderedPAs {
            let paPitches = (pitchesByPaId[pa.id] ?? []).sorted { $0.pitchOrder < $1.pitchOrder }
            for (idx, pitch) in paPitches.enumerated() {
                entries.append((pitch, idx + 1))
                seenPitchIds.insert(pitch.id)
            }
        }

        // Orphans
        for pitch in pitches.sorted(by: { $0.pitchOrder < $1.pitchOrder }) {
            if !seenPitchIds.contains(pitch.id) {
                entries.append((pitch, nil))
            }
        }

        var rows: [String] = [columns.joined(separator: ",")]

        for (gameSeq, entry) in entries.enumerated() {
            let pitch = entry.pitch
            let pa = paById[pitch.paId]
            let segment = pa.flatMap { segmentById[$0.segmentId] }

            let cells: [String] = [
                csvCell(game.id),
                csvCell(game.gameDate),
                csvCell(game.opponent),
                csvCell(game.status),
                csvCell(game.revision),
                csvCell(game.charter),
                csvCell(game.weather),
                csvCell(game.homeCatcher),
                csvCell(game.awayCatcher),
                csvCell(game.babsonRecord),
                csvCell(game.standing),
                csvCell(game.tomorrowStarter),
                csvCell(game.tomorrowOpponent),
                csvCell(game.notes),
                csvCell(segment?.id ?? pa.map { $0.segmentId } ?? ""),
                csvCell(segment?.segmentOrder),
                csvCell(segment?.playerId ?? ""),
                csvCell(segment?.displayName ?? ""),
                csvCell(segment?.enteredInning),
                csvCell(segment?.exitedInning),
                csvCell(segment?.runsOverride),
                csvCell(segment?.earnedRunsOverride),
                csvCell(pa?.id ?? pitch.paId),
                csvCell(pa?.paOrder),
                csvCell(pa?.inning),
                csvCell(pa?.hitterName ?? ""),
                csvCell(pa?.lineupSlot),
                csvCell(pa?.buntContext),
                csvCell(pa?.resultCode),
                csvCell(pitch.id),
                csvCell(gameSeq + 1),
                csvCell(entry.pitchNumInPA),
                csvCell(pitch.pitchOrder),
                csvCell("\(pitch.ballsBefore)-\(pitch.strikesBefore)"),
                csvCell(pitch.ballsBefore),
                csvCell(pitch.strikesBefore),
                csvCell(pitch.pitchType),
                csvCell(pitch.locationCell),
                csvCell(pitch.pitchResult),
                csvCell(pitch.velocity),
            ]

            rows.append(cells.joined(separator: ","))
        }

        return rows.joined(separator: "\r\n")
    }

    /// Build a filename like `charting-2026-03-08-MIT.csv`.
    static func filename(for game: PersistedGame) -> String {
        let oppSlug = game.opponent
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        return "charting-\(game.gameDate)-\(oppSlug.isEmpty ? "game" : oppSlug).csv"
    }

    /// Write CSV to a temporary file and return its URL (for ShareLink / UIActivityViewController).
    static func writeToTempFile(
        game: PersistedGame,
        segments: [PersistedSegment],
        plateAppearances: [PersistedPlateAppearance],
        pitches: [PersistedPitch]
    ) -> URL? {
        let csv = buildCSV(
            game: game,
            segments: segments,
            plateAppearances: plateAppearances,
            pitches: pitches
        )
        let tempDir = FileManager.default.temporaryDirectory
        let fileURL = tempDir.appendingPathComponent(filename(for: game))
        do {
            try csv.write(to: fileURL, atomically: true, encoding: .utf8)
            return fileURL
        } catch {
            print("CSVExporter: failed to write temp file: \(error)")
            return nil
        }
    }

    // MARK: - Helpers

    private static func csvCell(_ value: Any?) -> String {
        guard let value else { return "" }
        let str: String
        if let boolVal = value as? Bool {
            str = boolVal ? "true" : "false"
        } else {
            str = "\(value)"
        }
        if str.contains(",") || str.contains("\"") || str.contains("\r") || str.contains("\n") {
            return "\"\(str.replacingOccurrences(of: "\"", with: "\"\""))\""
        }
        return str
    }
}
