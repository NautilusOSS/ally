# TODO - Swap Interface Improvements

This document contains potential improvements for the Swap Interface component that can be considered individually in future prompts.

## High-Priority Improvements

### 1. MAX Button for Amount Input
- **Description**: Add a "MAX" button next to the amount input to fill with full wallet balance
- **Impact**: Common DEX pattern that users expect
- **Implementation**: Add button that fetches wallet balance and sets amount to max (accounting for fees)

### 2. Slippage Tolerance Setting
- **Description**: Add slippage tolerance input (currently hardcoded at 0.01/1%)
- **Impact**: Gives users control over trade execution
- **Implementation**: Add input field in UI, pass to API request body (currently uses `appConfig?.ui.defaultSlippageTolerance || 0.01`)

### 3. Better Error Messages
- **Description**: More specific, actionable error messages (e.g., "Insufficient balance", "Pool not found")
- **Impact**: Helps users understand and fix issues
- **Implementation**: Parse API error responses and map to user-friendly messages

### 4. Transaction Status Tracking
- **Description**: Show pending/completed status with explorer links after swap
- **Impact**: Better user feedback and transparency
- **Implementation**: Track transaction IDs, poll for confirmation, show status badges

### 5. Type Safety Improvements
- **Description**: Replace `any` types with proper TypeScript interfaces for quote data
- **Impact**: Better code maintainability and fewer runtime errors
- **Implementation**: Create interfaces for `Quote`, `SwapApiResponse`, `Route`, `Pool` types

### 6. Refresh Quote Button
- **Description**: Add manual refresh button with "Last updated" timestamp
- **Impact**: Users can refresh stale quotes without re-entering data
- **Implementation**: Add refresh button, store quote timestamp, show "Last updated X seconds ago"

### 7. Transaction Preview Modal
- **Description**: Show detailed preview before signing (amounts, fees, price impact, route)
- **Impact**: Better security and user confidence
- **Implementation**: Create modal component showing all transaction details before `handleSwap` is called

## Medium-Priority Improvements

### 9. Token Balance Display
- **Description**: Show wallet balances next to token selects
- **Impact**: Users can see available balance before swapping
- **Implementation**: Fetch and display token balances from wallet, show in token selector dropdown

### 10. Price Per Token Display
- **Description**: Show "1 VOI = X USD" or equivalent exchange rate
- **Impact**: Better price transparency
- **Implementation**: Calculate and display from quote data (already available in `swapApiData.rate`)

### 11. Loading Skeletons
- **Description**: Use skeleton loaders instead of simple "Loading..." text
- **Impact**: Better perceived performance
- **Implementation**: Add skeleton components for quote loading state

### 12. High Slippage Warnings
- **Description**: More prominent warnings when price impact > 5%
- **Impact**: Better risk communication
- **Implementation**: Enhance existing warning display, add modal for high-impact trades

### 13. Route Comparison Improvements
- **Description**: Better visualization of compared routes
- **Impact**: Helps users choose best route
- **Implementation**: Enhance route comparison UI with side-by-side comparison cards

### 14. Mobile Responsiveness
- **Description**: Improve mobile layout and touch targets
- **Impact**: Better mobile UX
- **Implementation**: Review and optimize mobile breakpoints, ensure all interactive elements are touch-friendly

## Nice-to-Have Improvements

### 15. Token Logos/Icons
- **Description**: Add token logos in selects and flow chart
- **Impact**: Better visual identification
- **Implementation**: Add logo URLs to token config, display in UI components

### 16. Recent Swaps Memory
- **Description**: Remember and quick-select recent token pairs
- **Impact**: Faster repeated swaps
- **Implementation**: Store recent swaps in localStorage, add quick-select UI

### 17. Clear/Reset Button
- **Description**: Quick reset of form state
- **Impact**: Convenience feature
- **Implementation**: Add button that clears amount, resets quote, clears errors

### 18. Copy Transaction ID
- **Description**: Copy button after successful swap
- **Impact**: Easy sharing/tracking
- **Implementation**: Add copy-to-clipboard button with transaction ID

### 19. Estimated Time Display
- **Description**: Show estimated swap completion time
- **Impact**: Better user expectations
- **Implementation**: Estimate based on network conditions, show in transaction status

### 20. Dark Mode Support
- **Description**: Add dark mode toggle
- **Impact**: Better accessibility and user preference
- **Implementation**: Add theme toggle, update Tailwind config for dark mode classes

## Notes

- All improvements should maintain the existing responsive design patterns
- Consider backward compatibility when adding new features
- Test all improvements on both desktop and mobile viewports
- Ensure accessibility standards are maintained (ARIA labels, keyboard navigation, etc.)

