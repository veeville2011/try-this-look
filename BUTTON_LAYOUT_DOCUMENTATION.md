# Button Layout Documentation - Mobile vs Desktop

## Overview
The button layout changes based on screen size and container width. There are two main layouts: **Wide Layout** (Desktop) and **Compact Layout** (Mobile).

---

## Layout Breakpoints

### Wide Layout (Desktop)
- **Trigger**: Container width ≥ 880px (`WIDE_LAYOUT_MIN_WIDTH_PX`)
- **Location**: `TryOnWidget.tsx` lines 2938-3596
- **Used when**: Widget is displayed in a wide popover or desktop viewport

### Compact Layout (Mobile)
- **Trigger**: Container width < 880px OR mobile device detected
- **Location**: `TryOnWidget.tsx` lines 3604-4067
- **Used when**: Widget is displayed on mobile devices or narrow viewports

---

## Desktop/Wide Layout Representation

### Button Order (Vertical Stack)
```
┌─────────────────────────────────┐
│  [Quantity Stepper]             │
│  (Right-aligned)                │
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │ 🛒 Ajouter au Panier      │  │ ← Add to Cart (Primary)
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 💳 Acheter maintenant     │  │ ← Buy Now (Secondary)
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Characteristics:**
- **Layout**: Vertical stack (`flex flex-col`)
- **Width**: Full width (`w-full`)
- **Min Width**: 220px per button (`min-w-[220px]`)
- **Height**: 44px (`h-11`)
- **Gap**: 12px between buttons (`gap-3`)
- **Alignment**: Right-aligned container (`items-end`)

**Code Location:**
```3549:3596:src/components/TryOnWidget.tsx
/* In Stock: Show Quantity + Add to Cart/Buy Now */
<div className="flex flex-col items-end gap-3 w-full">
  {/* Desktop: Quantity control on top, buttons stacked below */}
  <div className="flex items-center gap-3 w-full justify-end">
    <QuantityStepper />
  </div>
  <div className="flex flex-col gap-3 w-full">
    <Button onClick={handleAddToCart} ...>
      🛒 Ajouter au panier
    </Button>
    <Button onClick={handleBuyNow} ...>
      💳 Acheter maintenant
    </Button>
  </div>
</div>
```

---

## Mobile/Compact Layout Representation

### Button Order (Vertical Stack)
```
┌─────────────────────────────────┐
│  Quantité    [ - ] 1 [ + ]     │
│  (Full width, justified)        │
├─────────────────────────────────┤
│  ┌───────────────────────────┐ │
│  │ 🛒 Ajouter au Panier       │ │ ← Add to Cart (Primary)
│  └───────────────────────────┘ │
│  ┌───────────────────────────┐ │
│  │ 💳 Acheter maintenant     │ │ ← Buy Now (Secondary)
│  └───────────────────────────┘ │
└─────────────────────────────────┘
```

**Characteristics:**
- **Layout**: Vertical stack (`flex flex-col`)
- **Width**: Full width (`w-full`)
- **Height**: 44px (`h-11`)
- **Gap**: Natural spacing between elements
- **Quantity Display**: Shows label "Quantité" with stepper

**Code Location:**
```4008:4065:src/components/TryOnWidget.tsx
{/* In Stock: Show Quantity selector on top, then Add to Cart */}
{generatedImage && (
  <>
    {/* Mobile: Quantity control on top */}
    <div className="flex items-center justify-between gap-3 w-full">
      <p className="text-sm font-medium text-slate-700">
        Quantité
      </p>
      <QuantityStepper />
    </div>
    {/* Primary Action: Add to Cart */}
    <Button onClick={handleAddToCart} ...>
      🛒 Ajouter au panier
    </Button>
  </>
)}

{/* Secondary Action: Buy Now */}
{generatedImage && (
  <Button onClick={handleBuyNow} ...>
    💳 Acheter maintenant
  </Button>
)}
```

---

## ResultDisplay Component (Grid Layout)

### Mobile (< 640px)
```
┌─────────────────────────────────┐
│  ┌───────────────────────────┐  │
│  │ 🛒 Ajouter au Panier       │  │ ← Add to Cart
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 💳 Acheter Maintenant      │  │ ← Buy Now
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```
- **Grid**: Single column (`grid-cols-1`)
- **Gap**: 6px (`gap-1.5`)

### Tablet/Desktop (≥ 640px)
```
┌──────────────────┬──────────────────┐
│ 🛒 Ajouter au    │ 💳 Acheter       │
│    Panier        │    Maintenant    │
└──────────────────┴──────────────────┘
```
- **Grid**: Two columns (`sm:grid-cols-2 lg:grid-cols-2`)
- **Gap**: 8px (`sm:gap-2`)

**Code Location:**
```828:891:src/components/ResultDisplay.tsx
<div className="grid gap-1.5 sm:gap-2 auto-rows-min grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
  <Button onClick={handleAddToCart} ...>
    🛒 Ajouter au Panier
  </Button>
  <Button onClick={handleBuyNow} ...>
    💳 Acheter Maintenant
  </Button>
</div>
```

---

## Summary

### Button Order (All Layouts)
1. **Add to Cart** button appears **FIRST** (top/left)
2. **Buy Now** button appears **SECOND** (below/right)

### Layout Differences

| Feature | Desktop/Wide | Mobile/Compact |
|---------|-------------|----------------|
| **Container Width** | ≥ 880px | < 880px |
| **Button Layout** | Vertical stack | Vertical stack |
| **Button Width** | Full width (min 220px) | Full width |
| **Quantity Display** | Right-aligned, no label | Left label + right stepper |
| **Gap Between Buttons** | 12px | Natural spacing |
| **Grid Layout** | N/A | N/A (ResultDisplay uses grid) |

### Key Points
- ✅ **Consistent Order**: Add to Cart always appears before Buy Now
- ✅ **Responsive**: Layout adapts to screen size automatically
- ✅ **Full Width**: Buttons take full available width on mobile
- ✅ **Accessible**: Proper ARIA labels and keyboard navigation

---

## Visual Comparison

### Desktop/Wide Layout
```
                    [Quantity: - 1 +]
                    ┌───────────────┐
                    │ Add to Cart   │
                    └───────────────┘
                    ┌───────────────┐
                    │ Buy Now       │
                    └───────────────┘
```

### Mobile/Compact Layout
```
Quantité          [ - ] 1 [ + ]
┌─────────────────────────────┐
│ Add to Cart                 │
└─────────────────────────────┘
┌─────────────────────────────┐
│ Buy Now                     │
└─────────────────────────────┘
```

### ResultDisplay Grid (Tablet/Desktop)
```
┌──────────────┬──────────────┐
│ Add to Cart  │ Buy Now      │
└──────────────┴──────────────┘
```

