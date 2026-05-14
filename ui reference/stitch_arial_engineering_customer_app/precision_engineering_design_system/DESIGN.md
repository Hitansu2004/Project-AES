---
name: Precision Engineering Design System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cddbf0'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef4ff'
  surface-container: '#e5efff'
  surface-container-high: '#dbe9fe'
  surface-container-highest: '#d6e4f9'
  on-surface: '#0f1c2c'
  on-surface-variant: '#43474f'
  inverse-surface: '#243141'
  inverse-on-surface: '#e9f1ff'
  outline: '#737780'
  outline-variant: '#c3c6d1'
  surface-tint: '#3a5f94'
  primary: '#001e40'
  on-primary: '#ffffff'
  primary-container: '#003366'
  on-primary-container: '#799dd6'
  inverse-primary: '#a7c8ff'
  secondary: '#006689'
  on-secondary: '#ffffff'
  secondary-container: '#5bcaff'
  on-secondary-container: '#005371'
  tertiary: '#300056'
  on-tertiary: '#ffffff'
  tertiary-container: '#4e0086'
  on-tertiary-container: '#c07dff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#a7c8ff'
  on-primary-fixed: '#001b3c'
  on-primary-fixed-variant: '#1f477b'
  secondary-fixed: '#c3e8ff'
  secondary-fixed-dim: '#78d1ff'
  on-secondary-fixed: '#001e2c'
  on-secondary-fixed-variant: '#004c68'
  tertiary-fixed: '#f0dbff'
  tertiary-fixed-dim: '#deb7ff'
  on-tertiary-fixed: '#2c0050'
  on-tertiary-fixed-variant: '#6712aa'
  background: '#f8f9ff'
  on-background: '#0f1c2c'
  surface-variant: '#d6e4f9'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 40px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style

This design system is built for a high-trust, engineering-focused service environment. The aesthetic balances the rigor of technical maintenance with the approachability of a premium consumer experience. It employs a **Corporate / Modern** style characterized by structural clarity, generous whitespace, and a high-contrast typographic hierarchy.

The UI should feel authoritative yet effortless. We use a "Technical-Clean" approach: every element has a functional purpose, utilizing subtle depth and a restrained palette to ensure that critical engineering data and service statuses are the primary focus for the user.

## Colors

The palette is anchored by **Deep Navy (#003366)**, representing stability and institutional knowledge. We use **Teal-Blue (#0099CC)** as our primary action color to provide a high-visibility contrast that guides the user toward conversion and task completion.

The neutral system uses a cooling blue-gray scale to maintain a "clean-room" engineering feel. Background surfaces alternate between pure white and a soft blue-gray to create logical containment for cards and data tables. Distinctive badge colors (Purple, Blue, Red) are reserved strictly for service-type classification (AMC, Warranty, Paid) to allow for instant visual scanning of asset statuses.

## Typography

We utilize **Inter** across the entire system for its exceptional legibility and neutral, systematic tone. The typographic strategy hinges on a strong vertical rhythm. 

- **Headlines:** Always set in the Primary Navy color. Use bold weights to establish clear section breaks.
- **Body Text:** Standard communication uses the Text Secondary color to reduce visual noise, switching to Text Primary for specific data points.
- **Labels:** Used for badges and small UI descriptors, often employing medium or semi-bold weights to ensure readability at small sizes.

## Layout & Spacing

This design system follows a **Fixed-Fluid hybrid grid**. On mobile, we use a single-column layout with 20px side margins. On larger viewports, content is contained within a 12-column grid with a max-width of 1200px.

Spacing is governed by a 4px baseline shift. Vertical "stack" spacing (8px, 16px, 24px) is strictly enforced to create a sense of mechanical order. Elements related to the same engineering asset should be grouped with 8px spacing, while distinct sections should be separated by at least 24px to maintain the "Premium" feel.

## Elevation & Depth

We use **Ambient Shadows** to create a subtle hierarchy of layers. Depth is used sparingly to signify interactivity and containerization:

1.  **Level 0 (Surface):** The primary background (#FFFFFF), used for the page itself.
2.  **Level 1 (Card):** Uses a very soft, diffused shadow (`0 2px 12px rgba(0,0,0,0.08)`) to lift content above the background without creating harsh edges.
3.  **Level 2 (Navigation/Overlays):** Bottom navigation bars and modals use slightly higher contrast borders (#E2E8F0) and background blurs to ensure they sit clearly on top of scrolling content.

Engineering data should feel "set into" the page, while actionable items (Buttons/Cards) should feel slightly "raised."

## Shapes

The shape language is **Rounded (Level 2)**. 

- **Primary Containers (Cards):** 12px radius. This provides a modern, approachable feel while maintaining enough structure for technical data.
- **Form Elements:** Inputs use a slightly tighter 8px radius to feel more "tool-like" and precise.
- **Buttons:** Large action buttons use a 12px radius to match the card aesthetic, creating a cohesive visual unit.
- **Badges:** Small badges for status (AMC, Warranty) use a 4px or fully pill-shaped radius depending on context.

## Components

### Buttons
- **Primary Action:** 52px height, Teal-Blue (#0099CC) background, white bold text. This is the "high-utility" button for service requests.
- **Secondary Action:** 52px height, Navy (#003366) outline or transparent background with Navy text.

### Input Fields
- **Standard Input:** 52px height, Light Blue-Gray (#F4F7FC) background with an 8px corner radius. Borders should be transparent unless the field is focused, at which point a 2px Teal-Blue border appears.

### Cards
- **Asset/Service Cards:** Pure white background, 12px radius, and Level 1 shadow. These act as the primary container for equipment details, service history, and "Request Service" actions.

### Badges
- **Status Indicators:** Small, uppercase labels with a 4px radius. 
  - **AMC:** Purple (#7B2FBE)
  - **Warranty:** Blue (#0099CC)
  - **Paid Service:** Red (#E63946)

### Navigation
- **Bottom Nav:** 72px height, solid white. A thin top border (#E2E8F0) separates it from the content. Active states use Teal-Blue (#0099CC) for icons and labels to denote the current location.

### Lists
- Use a 1px border (#E2E8F0) between list items. Horizontal padding should match the 20px screen margin to ensure alignment.