package com.example.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.example.ui.components.DedicatedSearchBar
import com.example.ui.components.GothwadBottomBar
import com.example.ui.components.StandardTopBar
import com.example.ui.navigation.Screen
import com.example.ui.screens.AppsScreen
import com.example.ui.screens.GamesScreen
import com.example.ui.screens.HomeScreen
import com.example.ui.screens.ProfileScreen
import com.example.ui.screens.SearchScreen
import com.example.ui.theme.PlayBackground

/**
 * MainStoreScreen for Gothwad Store.
 * Coordinates TopBar rules, Jetpack Navigation Compose, BottomBar, and Screens.
 */
@Composable
fun MainStoreScreen() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: Screen.Home.route

    var searchQuery by remember { mutableStateOf("") }

    // Intercept back button when not on Home tab to return to Home
    if (currentRoute != Screen.Home.route) {
        BackHandler {
            navController.navigate(Screen.Home.route) {
                popUpTo(navController.graph.findStartDestination().id) {
                    saveState = true
                }
                launchSingleTop = true
                restoreState = true
            }
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = PlayBackground,
        contentWindowInsets = WindowInsets.statusBars,
        topBar = {
            if (currentRoute == Screen.Search.route) {
                // FOR SEARCH TAB: ONLY clean search bar taking full width
                DedicatedSearchBar(
                    query = searchQuery,
                    onQueryChange = { searchQuery = it },
                    onBackClick = {
                        navController.navigate(Screen.Home.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onMicClick = { /* Voice search trigger */ },
                    onSearchSubmit = { /* Submit search */ }
                )
            } else {
                // FOR HOME, APPS, GAMES, PROFILE: Title + Avatar, NO search bar
                StandardTopBar(
                    onProfileClick = {
                        navController.navigate(Screen.Profile.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }
        },
        bottomBar = {
            GothwadBottomBar(
                currentRoute = currentRoute,
                onTabSelected = { screen ->
                    if (screen.route != currentRoute) {
                        navController.navigate(screen.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                }
            )
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Home.route,
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            composable(Screen.Home.route) {
                HomeScreen(
                    onAppClick = { /* Navigates to AppDetailScreen in Phase 8 */ }
                )
            }
            composable(Screen.Apps.route) {
                AppsScreen()
            }
            composable(Screen.Search.route) {
                SearchScreen(
                    searchQuery = searchQuery,
                    onQueryChange = { searchQuery = it }
                )
            }
            composable(Screen.Games.route) {
                GamesScreen()
            }
            composable(Screen.Profile.route) {
                ProfileScreen()
            }
        }
    }
}
