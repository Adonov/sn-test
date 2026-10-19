import SwiftUI
import WidgetKit

// The app writes a JSON snapshot of today (see src/lib/widget.ts) into the shared App Group.
private let appGroup = "group.com.taisty.app"

struct Snapshot: Codable {
    var date: String
    var eaten: Double
    var goal: Double
    var burned: Double
    var protein: [Double]
    var carbs: [Double]
    var fat: [Double]
    var waterMl: Double
    var waterGoal: Double
    /// Start of the running fast in seconds since 1970, nil when not fasting.
    var fastStart: Double?
    var fastHours: Double
    var labels: [String: String]

    static let placeholder = Snapshot(
        date: "", eaten: 1240, goal: 2000, burned: 180, protein: [62, 110], carbs: [140, 220], fat: [40, 70],
        waterMl: 1000, waterGoal: 2000, fastStart: nil, fastHours: 16, labels: [:])

    static func load() -> Snapshot {
        guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: "snapshot"),
              let data = json.data(using: .utf8),
              let snapshot = try? JSONDecoder().decode(Snapshot.self, from: data)
        else { return placeholder }
        return snapshot.forToday()
    }

    static func today() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    /// Yesterday's totals don't count once the day has changed and the app hasn't been opened yet.
    func forToday() -> Snapshot {
        guard !date.isEmpty, date != Snapshot.today() else { return self }
        var copy = self
        copy.eaten = 0
        copy.burned = 0
        copy.protein[0] = 0
        copy.carbs[0] = 0
        copy.fat[0] = 0
        copy.waterMl = 0
        return copy
    }

    func label(_ key: String, _ fallback: String) -> String { labels[key] ?? fallback }

    var budget: Double { goal + burned }
    var left: Int { Int((budget - eaten).rounded()) }
    var progress: Double { budget > 0 ? min(eaten / budget, 1) : 0 }
    var fastStartDate: Date? { fastStart.map { Date(timeIntervalSince1970: $0) } }
    var fastEndDate: Date? { fastStartDate?.addingTimeInterval(fastHours * 3600) }
    func fastProgress(at now: Date) -> Double {
        guard let start = fastStartDate, fastHours > 0 else { return 0 }
        return min(max(now.timeIntervalSince(start) / (fastHours * 3600), 0), 1)
    }
}

struct Entry: TimelineEntry {
    let date: Date
    let snapshot: Snapshot
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: Date(), snapshot: .placeholder) }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(Entry(date: Date(), snapshot: context.isPreview ? .placeholder : .load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let snapshot = Snapshot.load()
        let now = Date()
        // Entries every 15 minutes keep the fasting ring moving; the app reloads on every change.
        let entries = (0..<16).map { Entry(date: now.addingTimeInterval(Double($0) * 900), snapshot: snapshot) }
        let midnight = Calendar.current.startOfDay(for: now.addingTimeInterval(86_400))
        let refresh = min(now.addingTimeInterval(4 * 3600), midnight)
        completion(Timeline(entries: entries, policy: .after(refresh)))
    }
}

// MARK: - Style

private let accent = Color(red: 0.15, green: 0.57, blue: 0.48)
// Macro colors match the app (validated for colour-blind separation).
private let proteinColor = Color(red: 0.92, green: 0.41, blue: 0.20)
private let carbsColor = Color(red: 0.16, green: 0.47, blue: 0.84)
private let fatColor = Color(red: 0.93, green: 0.63, blue: 0.0)
private let blue = Color(red: 0.16, green: 0.44, blue: 0.75)
private let widgetBackgroundColor = Color(UIColor { traits in
    traits.userInterfaceStyle == .dark
        ? UIColor(red: 0.09, green: 0.10, blue: 0.10, alpha: 1)
        : UIColor(red: 1, green: 1, blue: 1, alpha: 1)
})

extension View {
    @ViewBuilder func widgetBackground() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(widgetBackgroundColor, for: .widget)
        } else {
            padding().background(widgetBackgroundColor)
        }
    }
}

struct Ring<Content: View>: View {
    var progress: Double
    var color: Color
    var lineWidth: CGFloat = 9
    @ViewBuilder var content: Content

    var body: some View {
        ZStack {
            Circle().stroke(color.opacity(0.18), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            content
        }
    }
}

struct MacroBar: View {
    var name: String
    var values: [Double]
    var color: Color

    var body: some View {
        let value = values.first ?? 0
        let goal = values.count > 1 ? values[1] : 0
        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text(name).font(.caption2).foregroundStyle(.secondary)
                Spacer()
                Text("\(Int(value.rounded())) / \(Int(goal.rounded())) g").font(.caption2.monospacedDigit())
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(color.opacity(0.18))
                    Capsule().fill(color).frame(width: geo.size.width * (goal > 0 ? min(value / goal, 1) : 0))
                }
            }
            .frame(height: 5)
        }
    }
}

// MARK: - Calories

struct CaloriesView: View {
    @Environment(\.widgetFamily) var family
    let entry: Entry

    var leftText: some View {
        let s = entry.snapshot
        return VStack(spacing: 0) {
            Text("\(abs(s.left))").font(.system(.title2, design: .rounded).weight(.bold).monospacedDigit()).minimumScaleFactor(0.6)
            Text(s.left >= 0 ? s.label("left", "kcal left") : s.label("over", "kcal over"))
                .font(.caption2).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.7)
        }
    }

    var body: some View {
        let s = entry.snapshot
        switch family {
        case .accessoryCircular:
            Gauge(value: s.progress) {
                Text("kcal")
            } currentValueLabel: {
                Text("\(abs(s.left))").minimumScaleFactor(0.5)
            }
            .gaugeStyle(.accessoryCircularCapacity)
            .widgetBackground()
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text(s.label("today", "Today")).font(.headline)
                Text("\(abs(s.left)) \(s.left >= 0 ? s.label("left", "kcal left") : s.label("over", "kcal over"))")
                Gauge(value: s.progress) { EmptyView() }.gaugeStyle(.accessoryLinearCapacity)
            }
            .widgetBackground()
        case .systemMedium:
            HStack(spacing: 16) {
                Ring(progress: s.progress, color: accent, lineWidth: 11) { leftText }
                    .padding(4)
                VStack(alignment: .leading, spacing: 8) {
                    MacroBar(name: s.label("protein", "Protein"), values: s.protein, color: proteinColor)
                    MacroBar(name: s.label("carbs", "Carbs"), values: s.carbs, color: carbsColor)
                    MacroBar(name: s.label("fat", "Fat"), values: s.fat, color: fatColor)
                    HStack {
                        Text(s.label("water", "Water")).font(.caption2).foregroundStyle(.secondary)
                        Spacer()
                        Text(String(format: "%.1f / %.1f l", s.waterMl / 1000, s.waterGoal / 1000)).font(.caption2.monospacedDigit())
                    }
                }
            }
            .widgetBackground()
        default:
            VStack(spacing: 6) {
                Ring(progress: s.progress, color: accent) { leftText }
                Text("\(Int(s.eaten.rounded())) / \(Int(s.budget.rounded())) kcal")
                    .font(.caption2.monospacedDigit()).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.7)
            }
            .widgetBackground()
        }
    }
}

struct CaloriesWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "CaloriesWidget", provider: Provider()) { entry in
            CaloriesView(entry: entry).widgetURL(URL(string: "taisty://nutrition"))
        }
        .configurationDisplayName("Calories")
        .description("Calories left today, macros and water.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
    }
}

// MARK: - Fasting

struct FastingView: View {
    @Environment(\.widgetFamily) var family
    let entry: Entry

    var body: some View {
        let s = entry.snapshot
        let progress = s.fastProgress(at: entry.date)
        if let start = s.fastStartDate, let end = s.fastEndDate {
            switch family {
            case .accessoryCircular:
                Gauge(value: progress) {
                    Image(systemName: "timer")
                } currentValueLabel: {
                    Text(start, style: .timer).font(.caption2).minimumScaleFactor(0.4)
                }
                .gaugeStyle(.accessoryCircularCapacity)
                .widgetBackground()
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 2) {
                    Text(s.label("fasting", "Fasting")).font(.headline)
                    Text(start, style: .timer).monospacedDigit()
                    Text("\(s.label("ends", "Ends")) \(end.formatted(date: .omitted, time: .shortened))").font(.caption)
                }
                .widgetBackground()
            default:
                VStack(spacing: 6) {
                    Ring(progress: progress, color: blue) {
                        VStack(spacing: 0) {
                            Text(start, style: .timer)
                                .font(.headline.monospacedDigit()).multilineTextAlignment(.center).minimumScaleFactor(0.6)
                            Text(s.label("fasting", "Fasting")).font(.caption2).foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 10)
                    }
                    Text("\(s.label("ends", "Ends")) \(end.formatted(date: .omitted, time: .shortened))")
                        .font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                }
                .widgetBackground()
            }
        } else {
            switch family {
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    Image(systemName: "timer")
                }
                .widgetBackground()
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 2) {
                    Text(s.label("notFasting", "Not fasting")).font(.headline)
                    Text(s.label("startFast", "Start a fast"))
                }
                .widgetBackground()
            default:
                VStack(spacing: 8) {
                    Image(systemName: "timer").font(.largeTitle).foregroundStyle(blue)
                    Text(s.label("notFasting", "Not fasting")).font(.headline)
                    Text(s.label("startFast", "Start a fast")).font(.caption).foregroundStyle(.secondary)
                }
                .widgetBackground()
            }
        }
    }
}

struct FastingWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FastingWidget", provider: Provider()) { entry in
            FastingView(entry: entry).widgetURL(URL(string: "taisty://fasting"))
        }
        .configurationDisplayName("Fasting")
        .description("Your fasting timer at a glance.")
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular])
    }
}

@main
struct TaistyWidgets: WidgetBundle {
    var body: some Widget {
        CaloriesWidget()
        FastingWidget()
    }
}
