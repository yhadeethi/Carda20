# Carda 2.0 Design Guidelines

## Design Approach

**Selected System**: Apple Human Interface Guidelines with Glassmorphism Enhancements

**Rationale**: Carda is a professional productivity tool for salespeople and networkers. The Apple HIG provides the clarity, efficiency, and mobile-first focus needed for rapid contact scanning and intel review. Glassmorphism adds modern visual sophistication appropriate for a business intelligence tool while maintaining readability.

**Key Principles**:
- Clarity over decoration - information must be instantly scannable
- Depth through layering - glassmorphic cards create visual hierarchy
- Touch-first interactions - generous tap targets, smooth transitions
- Professional confidence - modern aesthetics without distraction

## Typography

**Font Stack**: 
- System font (-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto)
- Maintains native feel, optimal readability, zero load time

**Hierarchy**:
- Page Headers: 28px/bold (mobile), 32px/bold (desktop)
- Section Headers: 20px/semibold
- Card Titles: 18px/semibold
- Body Text: 16px/regular
- Metadata/Labels: 14px/medium
- Captions: 13px/regular

**Line Heights**: 1.5 for body text, 1.2 for headers

## Layout System

**Spacing Primitives**: Tailwind units of **2, 4, 6, 8, 12, 16**
- Compact spacing: p-2, gap-2 (8px)
- Standard spacing: p-4, gap-4 (16px)  
- Section spacing: p-6, py-8 (24px, 32px)
- Large spacing: p-12, py-16 (48px, 64px)

**Container Strategy**:
- Mobile: px-4 (16px side padding)
- Desktop: max-w-4xl mx-auto px-6
- Forms/Cards: max-w-2xl mx-auto

**Grid System**: Single column on mobile, selective 2-column on desktop for contact metadata

## Component Library

### Navigation - Tab Bar
- Fixed bottom navigation on mobile (iOS style)
- Two tabs: "Scan" and "My Card"
- Active tab: semibold text with accent indicator
- 60px height, safe area padding
- Icon + label format

### Cards - Glassmorphic Treatment
**Contact Cards**:
- Backdrop blur with subtle border
- Rounded corners (16px)
- Padding: p-6
- Shadow: soft, elevated appearance
- Fields arranged vertically with clear labels

**Intel Cards**:
- Nested within contact flow
- Slightly darker/deeper glass effect
- Sections: Company Snapshot, Recent News, Talking Points
- Collapsible sections with smooth expansion

### Forms
**Input Fields**:
- Rounded (12px), bordered style
- Clear labels above inputs
- Generous height (48px minimum)
- Focus state: border accent, subtle glow

**Buttons**:
- Primary: Full-width, 48px height, rounded (12px)
- Secondary: Outlined variant
- Tertiary: Text-only
- Icon buttons: 44px square minimum (touch target)

### Upload Interface
**Image Upload**:
- Large dropzone with dashed border
- Camera icon centered
- "Tap to upload" or "Drag business card photo"
- Preview thumbnail on upload with replace option

**Mode Switcher**:
- Toggle between "Scan Card" and "Paste Text"
- Segmented control style (iOS pattern)

### Data Display
**Recent Contacts List**:
- Card-based list items
- Avatar placeholder (initials) + Name + Company
- Right chevron for navigation
- Dividers between items

**Company Intel Display**:
- Structured sections with icons
- Snapshot: Key facts in grid format
- News: List with date + headline
- Talking Points: Numbered list with emphasis

### Special Components
**QR Code Section**:
- Centered display
- White background card (for scannability)
- Download/Share buttons below
- User name and title above QR

**Loading States**:
- Skeleton screens for contact cards
- Animated "Collecting intel..." with progress indicator
- Shimmer effect on placeholders

**Error States**:
- Friendly icon + message
- "Retry intel" button clearly visible
- Dismissible alert style for non-critical errors

## Glassmorphism Implementation

**Glass Cards**:
```
- Background: rgba(255, 255, 255, 0.1)
- Backdrop blur: 10-20px
- Border: 1px solid rgba(255, 255, 255, 0.2)
- Shadow: 0 8px 32px rgba(0, 0, 0, 0.1)
```

**Depth Layers**:
- Background: Subtle gradient or solid
- Level 1: Tab bar, main containers
- Level 2: Cards, forms
- Level 3: Modals, overlays

## Responsive Behavior

**Mobile (< 768px)**:
- Single column layout
- Bottom tab navigation
- Full-width cards
- Stacked form fields
- Touch-optimized spacing

**Desktop (≥ 768px)**:
- Side tab navigation or top bar
- Contact metadata in 2-column grid
- Maximum width containers (max-w-4xl)
- Hover states for interactive elements

## Images

**No hero images required** - this is a utility app focused on rapid task completion.

**Icon Strategy**:
- Use Heroicons (outline for inactive, solid for active states)
- Icons for: scan, person, company, news, link, download, share
- 24px standard size, 20px for inline usage

**Avatars/Placeholders**:
- Circular avatar placeholders with initials
- Grayscale or subtle brand tint when no photo

## Animation Principles

**Minimal, Purposeful Motion**:
- Tab transitions: 200ms ease
- Card appearances: Fade + slight slide up (300ms)
- Intel loading: Subtle pulse animation
- Button press: Scale down 0.98 (100ms)

**No Animations**:
- Background effects
- Scroll-triggered animations
- Decorative parallax

## Accessibility

- Minimum 44px touch targets
- Clear focus indicators on all interactive elements
- ARIA labels for icon-only buttons
- High contrast text (WCAG AA minimum)
- Form validation messages clearly associated with fields

## Quality Standards

This design creates a **professional, efficient mobile tool** that prioritizes:
- ⚡ Speed of task completion (scan → intel → save flow)
- 📱 Mobile-optimized interactions
- 🎯 Clear information hierarchy
- ✨ Modern glass aesthetic without sacrificing utility
- 🔐 Professional credibility for business context

The glassmorphic treatment adds sophistication while maintaining the clarity and efficiency required for rapid contact management and intelligence gathering.