package com.example.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.SportsEsports
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(
    val route: String,
    val title: String,
    val activeIcon: ImageVector,
    val inactiveIcon: ImageVector
) {
    object Home : Screen(
        route = "home",
        title = "Home",
        activeIcon = Icons.Filled.Home,
        inactiveIcon = Icons.Outlined.Home
    )

    object Apps : Screen(
        route = "apps",
        title = "Apps",
        activeIcon = Icons.Filled.GridView,
        inactiveIcon = Icons.Outlined.GridView
    )

    object Search : Screen(
        route = "search",
        title = "Search",
        activeIcon = Icons.Filled.Search,
        inactiveIcon = Icons.Outlined.Search
    )

    object Games : Screen(
        route = "games",
        title = "Games",
        activeIcon = Icons.Filled.SportsEsports,
        inactiveIcon = Icons.Outlined.SportsEsports
    )

    object Profile : Screen(
        route = "profile",
        title = "Profile",
        activeIcon = Icons.Filled.Person,
        inactiveIcon = Icons.Outlined.Person
    )

    companion object {
        val bottomNavTabs: List<Screen>
            get() = listOf(Home, Apps, Search, Games, Profile)
    }
}
