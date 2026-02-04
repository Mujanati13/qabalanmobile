# Language & Text Direction Flow

## Storage Layer ✅

**Location:** `src/contexts/LanguageContext.tsx`

- Language is stored in **AsyncStorage** with key: `'user_language'`
- Values: `'ar'` (Arabic) or `'en'` (English)
- Automatically loaded on app startup

## Context Layer ✅

**Location:** `src/contexts/LanguageContext.tsx`

```typescript
// On app startup
const storedLang = await getCurrentLanguageAsync(); // Reads from AsyncStorage
setCurrentLanguage(storedLang);
setIsRTLLayout(storedLang === 'ar'); // true for Arabic, false for English
```

**Exports:**
- `currentLanguage`: The selected language ('ar' or 'en')
- `isRTL`: Boolean indicating if current language is RTL
- `changeLanguage(language)`: Function to change language (saves to AsyncStorage)

## HomeScreen Implementation ✅

**Location:** `src/screens/HomeScreen.tsx`

```typescript
// Read language from context
const { currentLanguage, isRTL } = useLanguage();

// Create local state that syncs with context
const [language, setLanguage] = useState(currentLanguage);
const textDirection = language === 'ar' ? 'rtl' : 'ltr';

// Sync when context changes
useEffect(() => {
  setLanguage(currentLanguage);
}, [currentLanguage]);
```

## Text Direction Application ✅

All text elements in HomeScreen now have:
```typescript
style={[
  styles.textStyle, 
  isRTL && styles.rtlTextStyle,
  { 
    direction: textDirection,
    textAlign: textDirection === 'rtl' ? 'right' : 'left'
  }
]}
```

### Elements with direction styling:
- ✅ Banner titles & descriptions
- ✅ Category titles & product counts
- ✅ Product titles & prices
- ✅ Offer card titles & descriptions
- ✅ Section headers (all sections)
- ✅ Search results text

## Callback Dependencies ✅

All render callbacks include `textDirection` in dependency array:
- `renderBannerItem` - ✅
- `renderCategoryItem` - ✅
- `renderProductItem` - ✅
- `renderOfferCard` - ✅

This ensures components re-render when language/direction changes.

## Flow Diagram

```
User Changes Language
        ↓
LanguageContext.changeLanguage()
        ↓
Save to AsyncStorage ('user_language')
        ↓
Update currentLanguage state
        ↓
HomeScreen useEffect detects change
        ↓
Updates local language state
        ↓
textDirection recalculated
        ↓
Callbacks re-render (have textDirection in deps)
        ↓
Text direction styles applied
        ↓
UI updates immediately
```

## Testing

1. Open the app
2. Current language is loaded from AsyncStorage
3. Text direction is applied based on stored language
4. Switch language in settings
5. HomeScreen text immediately flows in correct direction
6. Close and reopen app
7. Language preference persists (loaded from AsyncStorage)
8. Text direction is correct on startup

## Notes

- No need for app restart after language change
- Direction changes are immediate and smooth
- All text elements respect the selected language direction
- Storage persists across app restarts
