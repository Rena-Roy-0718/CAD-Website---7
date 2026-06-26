# CAD Website 7

A browser-based Computer-Aided Design (CAD) application built entirely using HTML, CSS, and JavaScript. This project focuses on implementing professional 2D CAD concepts such as precision drawing, snapping systems, measurement tools, layer management, object editing, and multi-object workflows.

This version introduces advanced selection tools and professional snapping systems commonly found in modern CAD software.

---

## Features

### Drawing Tools

* Line
* Curve
* Arrow
* Rectangle
* Square
* Circle
* Ellipse
* Triangle
* Pentagon
* Hexagon
* Star

---

## Drawing Features

* Click-and-drag drawing
* Ghost preview before placement
* Live drawing preview
* Shape creation using the mouse

---

## Editing Tools

* Move objects
* Resize objects
* Rotate objects
* Copy objects
* Paste objects
* Duplicate objects
* Delete objects
* Right-click context menu

---

## Multi-Selection System

### Drag Selection Box

* Click and drag on an empty area to create a selection box.
* All shapes inside the selection box become selected.
* Selected objects display a dashed blue outline.
* Multiple objects can be moved, deleted, copied, or edited together.

### Ctrl + Click Selection

* Hold **Ctrl** and click shapes to add or remove them from the selection.
* Build custom selections easily.
* Supports **Ctrl + A** to select all unlocked visible shapes.

---

## Snapping System

### Grid Snap

* Snap to grid intersections.
* Ideal for rough layouts and aligned drawings.

### Endpoint Snap

* Snap to corners and endpoints of existing objects.
* Allows precise object connections.

### Midpoint Snap

* Snap to the exact midpoint of lines and edges.
* Useful for centred placements.

### Intersection Snap

* Snap to the mathematical intersection of two lines.
* Works even when no point physically exists.

### Snap Priority

1. Endpoint
2. Midpoint
3. Intersection
4. Grid

Multiple snap modes can be enabled simultaneously.

---

## Object Highlighting

* Hovering over objects displays a highlight.
* Makes selection easier when objects overlap.
* Indicates which object will be selected before clicking.

---

## Snap Indicators

Visual feedback appears near the cursor:

* Red = Endpoint
* Purple = Midpoint
* Green = Intersection
* Dark = Grid

The active snap type is also displayed in the status panel.

---

## Precision Tools

* Grid system
* Horizontal ruler
* Vertical ruler
* Adaptive ruler ticks
* Coordinate badge
* Live cursor coordinates
* Dimension tool
* Zoom from 5% to 500%

---

## Layers

* Create layers
* Rename layers
* Delete layers
* Hide layers
* Lock layers
* Assign objects to layers
* Active layer selection

---

## Units and Scale

### Supported Units

* Millimetres (mm)
* Centimetres (cm)
* Metres (m)
* Inches (in)
* Feet (ft)

### Drawing Scales

* 1:1
* 1:2
* 1:5
* 1:10
* 1:20
* 1:50
* 1:100
* 1:200
* 1:500

### Sheet Sizes

* A4
* A3
* A2
* A1
* A0

---

## Appearance Controls

* Fill colours
* Stroke colours
* Fill mode
* Stroke width adjustment
* Saved shapes list

---

## Productivity Features

* Undo (50 steps)
* Redo (50 steps)
* Keyboard shortcuts
* Context menu shortcuts
* Status display

---

## Screenshots

### Blank Page

![Blank Page](Screenshots/Blank%20page.png)

### Sample 1

![Sample 1](Screenshots/Sample%201.png)

### Sample 2

![Sample 2](Screenshots/Sample%202.png)

### Sample 3

![Sample 3](Screenshots/Sample%203.png)

### Sample 4

![Sample 4](Screenshots/Sample%204.png)

### Sample 5

![Sample 5](Screenshots/Sample%205.png)

---

## Project Structure

```text
CAD-Website---4/
│
├── index.html
├── style.css
├── script.js
├── README.md
├── LICENSE
├── .gitignore
│
└── Screenshots/
    ├── Blank page.png
    ├── Sample 1.png
    ├── Sample 2.png
    ├── Sample 3.png
    ├── Sample 4.png
    └── Sample 5.png
```

---

## Technologies Used

* HTML5
* CSS3
* JavaScript
* HTML5 Canvas API

---

## Browser Support

* Google Chrome
* Mozilla Firefox
* Microsoft Edge
* Safari

---

## Getting Started

No installation required.

1. Download or clone this repository
2. Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari)

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
open index.html
```

> **Note:** Keep `index.html`, `style.css`, and `script.js` in the same folder — the page will not work if they are separated.

---

## License

This project is licensed under the MIT License.

See the LICENSE file for additional details.

---

## Author

**Rena Roy V S**

Computer Science Engineering Student

Loyola ICAM College of Engineering and Technology

Chennai, India
