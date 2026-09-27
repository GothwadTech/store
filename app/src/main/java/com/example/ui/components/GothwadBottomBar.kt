package com.example.ui.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.navigation.Screen
import com.example.ui.theme.PlayGreen
import com.example.ui.theme.PlayPillIndicator
import com.example.ui.theme.PlaySurface
import com.example.ui.theme.PlayTextSecondary

/**
 * Bottom Navigation Bar for Gothwad Store (fixed, always visible).
 * White background, subtle top shadow (elevation 8dp).
 * 5 tabs: Home, Apps, Search, Games, Profile.
 * Active: Green (#01875F) icon + text + pill indicator behind icon.
 * Inactive: Grey (#5F6368).
 * Text: 12sp, Icon: 24dp.
 */
@Composable
fun GothwadBottomBar(
    currentRoute: String,
    onTabSelected: (Screen) -> Unit,
    modifier: Modifier = Modifier
) {
    NavigationBar(
        modifier = modifier
            .fillMaxWidth()
            .height(68.dp)
            .shadow(elevation = 8.dp)
            .testTag("bottom_navigation_bar"),
        containerColor = PlaySurface,
        tonalElevation = 0.dp
    ) {
        Screen.bottomNavTabs.forEach { screen ->
            val isSelected = currentRoute == screen.route

            NavigationBarItem(
                selected = isSelected,
                onClick = { onTabSelected(screen) },
                icon = {
                    Icon(
                        imageVector = if (isSelected) screen.activeIcon else screen.inactiveIcon,
                        contentDescription = screen.title,
                        modifier = Modifier.size(24.dp)
                    )
                },
                label = {
                    Text(
                        text = screen.title,
                        fontSize = 12.sp,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = PlayGreen,
                    unselectedIconColor = PlayTextSecondary,
                    selectedTextColor = PlayGreen,
                    unselectedTextColor = PlayTextSecondary,
                    indicatorColor = PlayPillIndicator
                ),
                modifier = Modifier.testTag("tab_${screen.route}")
            )
        }
    }
}
