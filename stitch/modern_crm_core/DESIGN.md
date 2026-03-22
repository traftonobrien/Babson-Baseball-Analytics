# Design System Document

## 1. Overview & Creative North Star: "The Digital Atrium"
This design system moves beyond the standard "SaaS dashboard" aesthetic to embrace a concept we call **The Digital Atrium**. 

Traditional CRM interfaces are often rigid, defined by heavy borders and claustrophobic grids. The Digital Atrium represents a shift toward open air, light, and structured depth. We treat the UI as a physical space where information is held on "suspended surfaces" rather than flat boxes. By utilizing a sophisticated scale of violet tones and monochromatic layering, we create an environment that feels premium, authoritative, and intentionally curated. This is achieved through three key principles:
*   **Atmospheric Depth:** Using tonal shifts instead of lines to define space.
*   **Editorial Authority:** Utilizing aggressive typographic scaling to separate high-level insights from granular data.
*   **Intentional Asymmetry:** Breaking the expected 4-column grid with varied container widths to guide the eye toward the most critical sales performance metrics.

---

## 2. Color & Surface Logic
The palette is rooted in a deep, regal primary violet, supported by a vast range of technical neutrals that provide the "oxygen" for the interface.

### The Palette
*   **Primary (`#630ed4`):** Our brand anchor. Used for high-intent actions.
*   **Primary Container (`#7C3AED`):** Used for active states and critical visual highlights.
*   **Surface (`#f8f9ff`):** The foundational "floor" of the application.
*   **Tertiary (`#005b3d`):** Reserved strictly for success metrics and "Active" status indicators.
*   **Error (`#ba1a1a`):** Critical alerts and destructive actions.

### The "No-Line" Rule
To maintain a high-end editorial feel, **1px solid borders are prohibited** for sectioning. Structural boundaries must be defined solely through background color shifts or tonal nesting.
*   *Example:* A sidebar should be `surface-container-low` against a main content area of `surface`. No vertical line should separate them.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. We use the "Stacked Paper" methodology:
1.  **Canvas:** `surface` (Base layer)
2.  **Sections:** `surface-container-low` (Subtle recessed areas)
3.  **Actionable Cards:** `surface-container-lowest` (The "purest" white, appearing to float closest to the user)

### The "Glass & Gradient" Rule
For elements that exist "above" the workflow (like floating notifications or navigation highlights), use Glassmorphism. Apply `surface-container-lowest` at 80% opacity with a `backdrop-filter: blur(12px)`. To provide "soul," use a subtle linear gradient on primary buttons transitioning from `primary` to `primary_container`.

---

## 3. Typography: The Editorial Scale
We use **Inter** exclusively. The beauty of this system lies in the dramatic contrast between `display` and `body` scales, mimicking a high-end financial magazine.

*   **Display & Headline:** Use `display-md` (2.75rem) for hero metrics like "Total Value." This communicates confidence.
*   **Titles:** Use `title-lg` (1.375rem) for card headers. These should have a tighter letter-spacing (-0.02em) to feel "custom."
*   **Body:** `body-md` (0.875rem) is the workhorse for all CRM data entry and labels.
*   **Labels:** `label-sm` (0.6875rem) should be used in all-caps with increased letter-spacing (0.05em) for metadata and table headers.

---

## 4. Elevation & Depth
Depth is not a decoration; it is a navigational tool.

### The Layering Principle
Achieve hierarchy by stacking tiers. Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a soft, natural lift that feels architectural rather than digital.

### Ambient Shadows
When a card must "float" (e.g., a hover state or a modal), use an **Extra-Diffused Ambient Shadow**:
*   **Blur:** 24px - 40px
*   **Opacity:** 4% - 6%
*   **Color:** Use a tinted version of `on-surface` (a deep navy/slate) rather than pure black to avoid a "dirty" look.

### The "Ghost Border" Fallback
In high-density data views where tonal shifts aren't enough, use a **Ghost Border**: `outline-variant` at 15% opacity. This provides a structural hint without cluttering the visual field.

---

## 5. Components

### Buttons
*   **Primary:** Solid `primary` background with `on-primary` text. Use `radius-md` (0.75rem).
*   **Secondary:** `surface-container-high` background. No border.
*   **Tertiary/Ghost:** No background. Use `primary` color for text.

### Cards & Lists
*   **Forbid dividers.** Use vertical white space (`spacing-6` or `spacing-8`) to separate list items. 
*   **Selection:** Active items in a list should use `primary_fixed` (a soft lavender) to highlight the row without the harshness of a dark color.

### Status Chips
*   **Active:** `tertiary_fixed_dim` background with `on-tertiary_fixed` text.
*   **Pending:** `secondary_container` background with `on-secondary_container` text.
*   **Interactive:** Chips used for filtering must use a `radius-full` to distinguish them from static status tags.

### Input Fields
*   **Default State:** `surface-container-low` background with a `ghost-border`.
*   **Focus State:** Transition the border to `primary` and add a 2px outer "glow" using `primary_fixed` at 50% opacity.

---

## 6. Do's and Don'ts

### Do
*   **Do** use `spacing-12` and `spacing-16` for page margins to create a sense of luxury and "breathing room."
*   **Do** use `radius-lg` (1rem) for main dashboard cards to soften the data-heavy environment.
*   **Do** ensure all "interactive" icons (Settings, Notifications) are housed in `surface-container-high` circular bases.

### Don't
*   **Don't** use 100% black text. Always use `on-surface` (`#121c2a`) for better readability and a more premium feel.
*   **Don't** use "Drop Shadows" on every card. Reserve shadows only for elements that physically move or overlap others.
*   **Don't** use standard 1px lines to separate sidebar navigation. Use background active-states (Glassmorphism) to indicate the current page.

### Accessibility Note
While we prioritize "softness," always ensure that text on `surface-container` tiers maintains a 4.5:1 contrast ratio. Use the `on-surface-variant` token for secondary text to ensure legibility is never sacrificed for style.