import SwiftUI

/// 14-cell Trackman strike zone representation.
struct ZoneGridView: View {
    @Bindable var state: ChartingState
    
    private let cellSize: CGFloat = 60
    private let cornerThickness: CGFloat = 40
    private let gap: CGFloat = 4
    
    var body: some View {
        GeometryReader { proxy in
            let baseGridWidth = cellSize * 3 + cornerThickness * 2 + gap * 4
            let baseGridHeight = cellSize * 3 + cornerThickness * 2 + gap * 4
            let availableWidth = max(proxy.size.width - 4, 1)
            let availableHeight = max(proxy.size.height - 4, 1)
            let scale = min(availableWidth / baseGridWidth, availableHeight / baseGridHeight)
            let fittedScale = min(scale, 3.6)
            
            ZStack {
                Color.clear
                
                // Top-Left L (11)
                cellButton(11, shape: .lShapeTopLeft)
                    .frame(width: cellSize * 1.5 + gap + cornerThickness/2, height: cellSize * 1.5 + gap + cornerThickness/2)
                    .offset(x: -(cellSize + gap + cornerThickness/4), y: -(cellSize + gap + cornerThickness/4))
                
                // Top-Right L (12)
                cellButton(12, shape: .lShapeTopRight)
                    .frame(width: cellSize * 1.5 + gap + cornerThickness/2, height: cellSize * 1.5 + gap + cornerThickness/2)
                    .offset(x: (cellSize + gap + cornerThickness/4), y: -(cellSize + gap + cornerThickness/4))
                
                // Bottom-Left L (13)
                cellButton(13, shape: .lShapeBottomLeft)
                    .frame(width: cellSize * 1.5 + gap + cornerThickness/2, height: cellSize * 1.5 + gap + cornerThickness/2)
                    .offset(x: -(cellSize + gap + cornerThickness/4), y: (cellSize + gap + cornerThickness/4))
                
                // Bottom-Right L (14)
                cellButton(14, shape: .lShapeBottomRight)
                    .frame(width: cellSize * 1.5 + gap + cornerThickness/2, height: cellSize * 1.5 + gap + cornerThickness/2)
                    .offset(x: (cellSize + gap + cornerThickness/4), y: (cellSize + gap + cornerThickness/4))
                
                // Center 3x3 Grid (1-9)
                VStack(spacing: gap) {
                    HStack(spacing: gap) {
                        cellButton(1)
                        cellButton(2)
                        cellButton(3)
                    }
                    HStack(spacing: gap) {
                        cellButton(4)
                        cellButton(5)
                        cellButton(6)
                    }
                    HStack(spacing: gap) {
                        cellButton(7)
                        cellButton(8)
                        cellButton(9)
                    }
                }
                .frame(width: cellSize * 3 + gap * 2, height: cellSize * 3 + gap * 2)
            }
            .frame(width: baseGridWidth, height: baseGridHeight)
            .scaleEffect(fittedScale)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

// Ensure shape returns standard centering for non-custom paths.
extension ZoneGridView {
    @ViewBuilder
    private func cellButton(_ id: Int, label: String? = nil, shape: CellShape = .square) -> some View {
        let isSelected = state.selectedLocation == id
        
        Button {
            state.selectedLocation = id
        } label: {
            ZStack {
                shape.makeShape(thickness: cornerThickness)
                    .fill(isSelected ? Color.blue : Color(white: 0.85))
                    .overlay(
                        shape.makeShape(thickness: cornerThickness)
                            .stroke(isSelected ? Color.blue.opacity(0.8) : Color.black.opacity(0.8), lineWidth: 2)
                    )
                
                if shape == .square || shape == .pill {
                    Text(label ?? "\(id)")
                        .font(.headline)
                        .foregroundStyle(isSelected ? .white : Color(white: 0.3))
                } else {
                    // For L-shapes, we use GeometryReader to place the text precisely in the thick corner
                    GeometryReader { geo in
                        Text("\(id)")
                            .font(.headline)
                            .foregroundStyle(isSelected ? .white : Color(white: 0.3))
                            .position(textPositionForL(shape: shape, size: geo.size))
                    }
                }
            }
            .frame(maxWidth: shape == .square ? .infinity : nil, maxHeight: shape == .square ? .infinity : nil)
            .aspectRatio(shape == .square ? 1.0 : nil, contentMode: .fit)
        }
        .buttonStyle(.plain)
    }
    
    private func textPositionForL(shape: CellShape, size: CGSize) -> CGPoint {
        // Place text in the outer corners of the L block
        let padding: CGFloat = 20
        switch shape {
        case .lShapeTopLeft:     return CGPoint(x: padding, y: padding)
        case .lShapeTopRight:    return CGPoint(x: size.width - padding, y: padding)
        case .lShapeBottomLeft:  return CGPoint(x: padding, y: size.height - padding)
        case .lShapeBottomRight: return CGPoint(x: size.width - padding, y: size.height - padding)
        default: return CGPoint(x: size.width/2, y: size.height/2)
        }
    }
}

enum CellShape: Equatable {
    case square, pill
    case lShapeTopLeft, lShapeTopRight, lShapeBottomLeft, lShapeBottomRight
    
    // We erase the types to AnyShape so we can return them all from the same method without Opaque return type issues
    func makeShape(thickness: CGFloat) -> AnyShape {
        switch self {
        case .square:
            return AnyShape(Rectangle())
        case .pill:
            return AnyShape(RoundedRectangle(cornerRadius: 16))
        case .lShapeTopLeft:
            return AnyShape(LShape(corner: .topLeft, thickness: thickness))
        case .lShapeTopRight:
            return AnyShape(LShape(corner: .topRight, thickness: thickness))
        case .lShapeBottomLeft:
            return AnyShape(LShape(corner: .bottomLeft, thickness: thickness))
        case .lShapeBottomRight:
            return AnyShape(LShape(corner: .bottomRight, thickness: thickness))
        }
    }
}

/// A custom Insettable shape representing an L-bracket.
struct LShape: InsettableShape {
    enum Corner { case topLeft, topRight, bottomLeft, bottomRight }
    
    var corner: Corner
    var thickness: CGFloat
    var insetAmount: CGFloat = 0
    
    func inset(by amount: CGFloat) -> LShape {
        var shape = self
        shape.insetAmount += amount
        return shape
    }
    
    func path(in rect: CGRect) -> Path {
        var path = Path()
        
        let minX = rect.minX + insetAmount
        let minY = rect.minY + insetAmount
        let maxX = rect.maxX - insetAmount
        let maxY = rect.maxY - insetAmount
        
        let t = thickness - (insetAmount * 1.5) // approximate inset adjustment on inner elbows
        
        switch corner {
        case .topLeft:
            path.move(to: CGPoint(x: minX, y: minY))
            path.addLine(to: CGPoint(x: maxX, y: minY))
            path.addLine(to: CGPoint(x: maxX, y: minY + t))
            path.addLine(to: CGPoint(x: minX + t, y: minY + t))
            path.addLine(to: CGPoint(x: minX + t, y: maxY))
            path.addLine(to: CGPoint(x: minX, y: maxY))
            
        case .topRight:
            path.move(to: CGPoint(x: maxX, y: minY))
            path.addLine(to: CGPoint(x: maxX, y: maxY))
            path.addLine(to: CGPoint(x: maxX - t, y: maxY))
            path.addLine(to: CGPoint(x: maxX - t, y: minY + t))
            path.addLine(to: CGPoint(x: minX, y: minY + t))
            path.addLine(to: CGPoint(x: minX, y: minY))
            
        case .bottomLeft:
            path.move(to: CGPoint(x: minX, y: maxY))
            path.addLine(to: CGPoint(x: minX, y: minY))
            path.addLine(to: CGPoint(x: minX + t, y: minY))
            path.addLine(to: CGPoint(x: minX + t, y: maxY - t))
            path.addLine(to: CGPoint(x: maxX, y: maxY - t))
            path.addLine(to: CGPoint(x: maxX, y: maxY))
            
        case .bottomRight:
            path.move(to: CGPoint(x: maxX, y: maxY))
            path.addLine(to: CGPoint(x: minX, y: maxY))
            path.addLine(to: CGPoint(x: minX, y: maxY - t))
            path.addLine(to: CGPoint(x: maxX - t, y: maxY - t))
            path.addLine(to: CGPoint(x: maxX - t, y: minY))
            path.addLine(to: CGPoint(x: maxX, y: minY))
        }
        
        path.closeSubpath()
        return path
    }
}
