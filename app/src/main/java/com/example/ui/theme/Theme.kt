package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary = PlayGreen,
    onPrimary = Color.White,
    primaryContainer = PlayGreenLight,
    onPrimaryContainer = PlayGreen,
    secondary = PlayGreen,
    onSecondary = Color.White,
    secondaryContainer = PlayGreenLight,
    onSecondaryContainer = PlayGreenDark,
    background = PlayBackground,
    onBackground = PlayTextPrimary,
    surface = PlaySurface,
    onSurface = PlayTextPrimary,
    surfaceVariant = PlaySearchBarBg,
    onSurfaceVariant = PlayTextSecondary,
    outline = PlayBorder,
    outlineVariant = PlayDivider,
    error = PlayError,
    onError = Color.White
)

@Composable
fun GothwadStoreTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = Typography,
        content = content
    )
}

@Composable
fun MyApplicationTheme(
    darkTheme: Boolean = false,
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    GothwadStoreTheme(content = content)
}
