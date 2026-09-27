package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.DummyStoreData
import com.example.data.model.AppItem
import com.example.data.model.CategoryItem
import com.example.data.model.GameItem
import com.example.ui.theme.PlayBackground
import com.example.ui.theme.PlayBannerGradientEnd
import com.example.ui.theme.PlayBannerGradientStart
import com.example.ui.theme.PlayBorder
import com.example.ui.theme.PlayDivider
import com.example.ui.theme.PlayGreen
import com.example.ui.theme.PlayGreenBadge
import com.example.ui.theme.PlayGreenLight
import com.example.ui.theme.PlaySearchBarBg
import com.example.ui.theme.PlayStarYellow
import com.example.ui.theme.PlayTextPrimary
import com.example.ui.theme.PlayTextSecondary
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * HomeScreen for Gothwad Store.
 * Complete Home Tab:
 * - Pull-to-refresh with green indicator
 * - Filter Chips Row ("For you", "Top charts", "Categories", "Editors' choice", "Early access")
 * - "Suggested for you" Section (Carousel of 280x160dp cards)
 * - "Featured Banner" (180dp gradient, "New & Updated", decorative icons)
 * - "Top free apps" Section (120dp wide cards, 56dp squircle icon, rating, install text)
 * - "Recommended games" Section (200x140dp game screenshot cards with dark gradient overlay)
 * - "Trending now" Section (Numbered vertical list 1-10 with ranks, categories, dividers)
 * - "Categories" Grid (2-column tinted cards: Social, Entertainment, Tools, Photo, Edu, Finance, Health, Shop)
 * - 20dp gap between sections, 80dp bottom padding for bottom nav clearance
 */
@Composable
fun HomeScreen(
    onAppClick: (AppItem) -> Unit = {},
    modifier: Modifier = Modifier
) {
    var selectedChip by remember { mutableStateOf("For you") }
    var installedApps by remember { mutableStateOf(setOf<String>()) }
    var isRefreshing by remember { mutableStateOf(false) }

    Box(modifier = modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(PlayBackground)
                .testTag("home_screen_content"),
            contentPadding = PaddingValues(bottom = 80.dp)
        ) {
            // 1. FILTER CHIPS ROW (Phase 2)
            item {
                FilterChipsRow(
                    chips = DummyStoreData.filterChips,
                    selectedChip = selectedChip,
                    onChipSelected = { selectedChip = it },
                    modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                )
            }

            // 2. "SUGGESTED FOR YOU" SECTION (Phase 2)
            item {
                Spacer(modifier = Modifier.height(12.dp))
                SuggestedForYouSection(
                    apps = DummyStoreData.suggestedApps,
                    installedApps = installedApps,
                    onInstallToggle = { app ->
                        installedApps = if (installedApps.contains(app.packageName)) {
                            installedApps - app.packageName
                        } else {
                            installedApps + app.packageName
                        }
                    },
                    onAppClick = onAppClick,
                    onMoreClick = { /* View more suggested */ }
                )
            }

            // 3. "FEATURED BANNER" (Phase 3)
            item {
                Spacer(modifier = Modifier.height(20.dp))
                FeaturedPromoBanner(
                    onExploreClick = { /* Navigate to new & updated apps */ }
                )
            }

            // 4. "TOP FREE APPS" SECTION (Phase 3)
            item {
                Spacer(modifier = Modifier.height(20.dp))
                TopFreeAppsSection(
                    apps = DummyStoreData.topFreeApps,
                    installedApps = installedApps,
                    onInstallToggle = { app ->
                        installedApps = if (installedApps.contains(app.packageName)) {
                            installedApps - app.packageName
                        } else {
                            installedApps + app.packageName
                        }
                    },
                    onAppClick = onAppClick,
                    onMoreClick = { /* View top free charts */ }
                )
            }

            // 5. "RECOMMENDED GAMES" SECTION (Phase 3)
            item {
                Spacer(modifier = Modifier.height(20.dp))
                RecommendedGamesSection(
                    games = DummyStoreData.recommendedGames,
                    installedApps = installedApps,
                    onInstallToggle = { game ->
                        installedApps = if (installedApps.contains(game.id)) {
                            installedApps - game.id
                        } else {
                            installedApps + game.id
                        }
                    },
                    onGameClick = { game ->
                        onAppClick(
                            AppItem(
                                packageName = game.id,
                                name = game.name,
                                developerName = "Game Studio",
                                category = "Games",
                                rating = game.rating,
                                iconBackgroundColor = game.primaryColor
                            )
                        )
                    },
                    onMoreClick = { /* View recommended games */ }
                )
            }

            // 6. "TRENDING NOW" NUMBERED LIST (Phase 3)
            item {
                Spacer(modifier = Modifier.height(20.dp))
                TrendingNowSection(
                    apps = DummyStoreData.trendingApps,
                    installedApps = installedApps,
                    onInstallToggle = { app ->
                        installedApps = if (installedApps.contains(app.packageName)) {
                            installedApps - app.packageName
                        } else {
                            installedApps + app.packageName
                        }
                    },
                    onAppClick = onAppClick,
                    onMoreClick = { /* View trending charts */ }
                )
            }

            // 7. "CATEGORIES" GRID (Phase 3)
            item {
                Spacer(modifier = Modifier.height(20.dp))
                HomeCategoriesSection(
                    categories = DummyStoreData.homeCategories,
                    onCategoryClick = { /* Open category */ },
                    onMoreClick = { /* View all categories */ }
                )
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

/**
 * Filter Chips Row
 * Height: 32dp, radius: 16dp, padding: 16dp horizontal, 8dp gap.
 * Active: light green bg (#E6F4EA), green text (#01875F).
 * Inactive: white bg, grey border (#DADCE0), grey text (#5F6368).
 */
@Composable
fun FilterChipsRow(
    chips: List<String>,
    selectedChip: String,
    onChipSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        chips.forEach { chipName ->
            val isSelected = chipName == selectedChip

            Box(
                modifier = Modifier
                    .height(32.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(if (isSelected) PlayGreenLight else PlayBackground)
                    .then(
                        if (!isSelected) {
                            Modifier.border(1.dp, PlayBorder, RoundedCornerShape(16.dp))
                        } else {
                            Modifier
                        }
                    )
                    .clickable { onChipSelected(chipName) }
                    .padding(horizontal = 14.dp)
                    .testTag("filter_chip_$chipName"),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = chipName,
                    color = if (isSelected) PlayGreen else PlayTextSecondary,
                    fontSize = 13.sp,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium
                )
            }
        }
    }
}

/**
 * "Suggested for you" Section.
 * Heading: "Suggested for you" (bold, 18sp, #202124) + right arrow ">" (grey).
 * Horizontal carousel of large cards (280x160dp, radius 12dp, shadow).
 */
@Composable
fun SuggestedForYouSection(
    apps: List<AppItem>,
    installedApps: Set<String>,
    onInstallToggle: (AppItem) -> Unit,
    onAppClick: (AppItem) -> Unit,
    onMoreClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .testTag("suggested_for_you_section")
    ) {
        // Section Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onMoreClick() }
                .padding(horizontal = 16.dp, vertical = 6.dp)
                .testTag("suggested_section_header"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Suggested for you",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = PlayTextPrimary
            )

            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = "View more suggested apps",
                tint = PlayTextSecondary,
                modifier = Modifier.size(24.dp)
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Horizontal Carousel
        LazyRow(
            modifier = Modifier
                .fillMaxWidth()
                .testTag("suggested_apps_carousel"),
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(apps, key = { it.packageName }) { app ->
                SuggestedAppCard(
                    app = app,
                    isInstalled = installedApps.contains(app.packageName),
                    onInstallClick = { onInstallToggle(app) },
                    onCardClick = { onAppClick(app) }
                )
            }
        }
    }
}

/**
 * Suggested App Card (280x160dp, radius 12dp, subtle elevation).
 */
@Composable
fun SuggestedAppCard(
    app: AppItem,
    isInstalled: Boolean,
    onInstallClick: () -> Unit,
    onCardClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showMenu by remember { mutableStateOf(false) }

    Card(
        modifier = modifier
            .width(280.dp)
            .height(160.dp)
            .clickable { onCardClick() }
            .testTag("suggested_card_${app.packageName}"),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = PlayBackground),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(app.iconBackgroundColor))
                        .testTag("app_icon_${app.packageName}"),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = app.name.take(1),
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )

                    if (app.isFoss) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.BottomEnd)
                                .padding(2.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(PlayGreenBadge)
                                .padding(horizontal = 3.dp, vertical = 1.dp)
                        ) {
                            Text(
                                text = "FOSS",
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = app.name,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = PlayTextPrimary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        lineHeight = 19.sp
                    )

                    Spacer(modifier = Modifier.height(2.dp))

                    Text(
                        text = app.category,
                        fontSize = 12.sp,
                        color = PlayTextSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    Spacer(modifier = Modifier.height(2.dp))

                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${app.rating}",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = PlayTextSecondary
                        )

                        Spacer(modifier = Modifier.width(2.dp))

                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = "Rating star",
                            tint = PlayStarYellow,
                            modifier = Modifier.size(12.dp)
                        )

                        Spacer(modifier = Modifier.width(6.dp))

                        Text(
                            text = "• ${app.downloadCount}",
                            fontSize = 12.sp,
                            color = PlayTextSecondary
                        )
                    }
                }

                Box {
                    IconButton(
                        onClick = { showMenu = true },
                        modifier = Modifier
                            .size(28.dp)
                            .testTag("menu_button_${app.packageName}")
                    ) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = "More options",
                            tint = PlayTextSecondary,
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    DropdownMenu(
                        expanded = showMenu,
                        onDismissRequest = { showMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("App info") },
                            onClick = {
                                showMenu = false
                                onCardClick()
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Share") },
                            onClick = { showMenu = false }
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedButton(
                    onClick = onInstallClick,
                    modifier = Modifier
                        .height(32.dp)
                        .testTag("install_button_${app.packageName}"),
                    shape = RoundedCornerShape(16.dp),
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        PlayGreen
                    ),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = if (isInstalled) PlayGreenLight else Color.Transparent,
                        contentColor = PlayGreen
                    ),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 0.dp)
                ) {
                    Text(
                        text = if (isInstalled) "Open" else "Install",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PlayGreen
                    )
                }
            }
        }
    }
}

/**
 * FEATURED BANNER (full width, 180dp height, 12dp radius, 16dp margin)
 * Gradient bg: #01875F → #00BCD4.
 * Left: "New & Updated" (bold, white, 22sp), "Discover latest apps" (white, 14sp), white "Explore" pill button.
 * Right: 3-4 overlapping decorative app icons.
 */
@Composable
fun FeaturedPromoBanner(
    onExploreClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .height(180.dp)
            .padding(horizontal = 16.dp)
            .testTag("featured_banner"),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(PlayBannerGradientStart, PlayBannerGradientEnd)
                    )
                )
                .padding(16.dp)
        ) {
            // Right Side: Decorative overlapping app icons
            Box(
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .width(130.dp)
                    .height(150.dp)
            ) {
                // Background icon 1
                Box(
                    modifier = Modifier
                        .size(52.dp)
                        .offset(x = 10.dp, y = 10.dp)
                        .rotate(-12f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White.copy(alpha = 0.25f)),
                    contentAlignment = Alignment.Center
                ) {
                    Text("G", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.8f))
                }

                // Background icon 2
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .offset(x = 55.dp, y = 45.dp)
                        .rotate(14f)
                        .clip(RoundedCornerShape(13.dp))
                        .background(Color.White.copy(alpha = 0.35f)),
                    contentAlignment = Alignment.Center
                ) {
                    Text("★", fontSize = 24.sp, color = Color.White.copy(alpha = 0.9f))
                }

                // Front primary icon 3
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .offset(x = 20.dp, y = 65.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.White.copy(alpha = 0.5f))
                        .border(1.5.dp, Color.White.copy(alpha = 0.7f), RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text("🚀", fontSize = 28.sp)
                }
            }

            // Left Side: Banner Text + Explore Button
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(end = 120.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "New & Updated",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        lineHeight = 26.sp
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = "Discover the latest apps",
                        fontSize = 14.sp,
                        color = Color.White.copy(alpha = 0.9f)
                    )
                }

                Button(
                    onClick = onExploreClick,
                    modifier = Modifier
                        .height(36.dp)
                        .testTag("explore_banner_button"),
                    shape = RoundedCornerShape(18.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor = PlayGreen
                    ),
                    contentPadding = PaddingValues(horizontal = 20.dp, vertical = 0.dp)
                ) {
                    Text(
                        text = "Explore",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = PlayGreen
                    )
                }
            }
        }
    }
}

/**
 * "TOP FREE APPS" SECTION:
 * Heading: "Top free apps" (bold, 18sp, #202124) + right arrow ">" (grey).
 * Horizontal scroll of small cards (120dp wide each):
 * a) App icon centered (56dp, squircle, 12dp radius).
 * b) App name below (bold, 13sp, max 2 lines, centered).
 * c) Star rating (grey, 11sp, centered).
 * d) "Install" text button (green #01875F, 12sp).
 * 12dp gap between cards, 16dp horizontal margin. 8 dummy apps.
 */
@Composable
fun TopFreeAppsSection(
    apps: List<AppItem>,
    installedApps: Set<String>,
    onInstallToggle: (AppItem) -> Unit,
    onAppClick: (AppItem) -> Unit,
    onMoreClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .testTag("top_free_apps_section")
    ) {
        // Section Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onMoreClick() }
                .padding(horizontal = 16.dp, vertical = 6.dp)
                .testTag("top_free_header"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Top free apps",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = PlayTextPrimary
            )

            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = "View all top free apps",
                tint = PlayTextSecondary,
                modifier = Modifier.size(24.dp)
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        LazyRow(
            modifier = Modifier
                .fillMaxWidth()
                .testTag("top_free_apps_row"),
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(apps, key = { it.packageName }) { app ->
                val isInstalled = installedApps.contains(app.packageName)
                Column(
                    modifier = Modifier
                        .width(120.dp)
                        .clickable { onAppClick(app) }
                        .testTag("top_free_card_${app.packageName}"),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Centered 56dp squircle icon (12dp radius)
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(app.iconBackgroundColor)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = app.name.take(1),
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // App Name (bold, 13sp, max 2 lines, centered)
                    Text(
                        text = app.name,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = PlayTextPrimary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center,
                        lineHeight = 16.sp,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    // Star rating (grey, 11sp, centered)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "${app.rating}",
                            fontSize = 11.sp,
                            color = PlayTextSecondary
                        )
                        Spacer(modifier = Modifier.width(2.dp))
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            tint = PlayStarYellow,
                            modifier = Modifier.size(11.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    // "Install" text button (green #01875F, 12sp)
                    Text(
                        text = if (isInstalled) "Open" else "Install",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = PlayGreen,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { onInstallToggle(app) }
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                            .testTag("top_free_install_${app.packageName}")
                    )
                }
            }
        }
    }
}

/**
 * "RECOMMENDED GAMES" SECTION:
 * Heading: "Recommended games" (bold, 18sp) + ">".
 * Horizontal scroll of game cards (200x140dp, 12dp radius):
 * a) Background: colored placeholder rectangle (game screenshot).
 * b) Bottom overlay: dark gradient (transparent → black 60%).
 * c) Game name on overlay (white, bold, 14sp).
 * d) Rating + small green "Install" button on overlay.
 * 12dp gap, 6 dummy games.
 */
@Composable
fun RecommendedGamesSection(
    games: List<GameItem>,
    installedApps: Set<String>,
    onInstallToggle: (GameItem) -> Unit,
    onGameClick: (GameItem) -> Unit,
    onMoreClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .testTag("recommended_games_section")
    ) {
        // Section Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onMoreClick() }
                .padding(horizontal = 16.dp, vertical = 6.dp)
                .testTag("recommended_games_header"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Recommended games",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = PlayTextPrimary
            )

            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = "View all games",
                tint = PlayTextSecondary,
                modifier = Modifier.size(24.dp)
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        LazyRow(
            modifier = Modifier
                .fillMaxWidth()
                .testTag("recommended_games_row"),
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(games, key = { it.id }) { game ->
                val isInstalled = installedApps.contains(game.id)

                Card(
                    modifier = Modifier
                        .width(200.dp)
                        .height(140.dp)
                        .clickable { onGameClick(game) }
                        .testTag("game_card_${game.id}"),
                    shape = RoundedCornerShape(12.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.linearGradient(
                                    colors = listOf(Color(game.primaryColor), Color(game.secondaryColor))
                                )
                            )
                    ) {
                        // Game Screenshot decorative pattern
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(12.dp)
                                .size(40.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color.White.copy(alpha = 0.25f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "🎮",
                                fontSize = 20.sp
                            )
                        }

                        // Bottom Overlay: Dark gradient (transparent → black 60%)
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(68.dp)
                                .align(Alignment.BottomCenter)
                                .background(
                                    Brush.verticalGradient(
                                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.75f))
                                    )
                                )
                                .padding(horizontal = 10.dp, vertical = 8.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .align(Alignment.BottomStart),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.Bottom
                            ) {
                                Column(
                                    modifier = Modifier.weight(1f).padding(end = 6.dp)
                                ) {
                                    Text(
                                        text = game.name,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )

                                    Row(
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "${game.rating}",
                                            fontSize = 11.sp,
                                            color = Color.White.copy(alpha = 0.9f)
                                        )
                                        Spacer(modifier = Modifier.width(2.dp))
                                        Icon(
                                            imageVector = Icons.Default.Star,
                                            contentDescription = null,
                                            tint = PlayStarYellow,
                                            modifier = Modifier.size(11.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            text = "• ${game.size}",
                                            fontSize = 10.sp,
                                            color = Color.White.copy(alpha = 0.75f)
                                        )
                                    }
                                }

                                // Small green "Install" button on overlay
                                Button(
                                    onClick = { onInstallToggle(game) },
                                    modifier = Modifier
                                        .height(26.dp)
                                        .testTag("game_install_${game.id}"),
                                    shape = RoundedCornerShape(13.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = PlayGreen,
                                        contentColor = Color.White
                                    ),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 0.dp)
                                ) {
                                    Text(
                                        text = if (isInstalled) "Open" else "Install",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * "TRENDING NOW" NUMBERED LIST:
 * Heading: "Trending now" (bold, 18sp) + ">".
 * Vertical numbered list (show 5 visible, scrollable within section).
 * Each row (72dp height, 16dp horizontal padding):
 * a) Rank number (bold, 18sp, grey #5F6368, 24dp width).
 * b) App icon (48dp, squircle, 8dp margin).
 * c) App name (bold, 15sp, #202124) + developer name below (grey, 12sp).
 * d) Category tag right side (grey pill, 11sp).
 * e) Star rating (grey, 11sp).
 * f) Green outlined "Install" pill button on far right.
 * Divider between rows (#E8EAED, 1dp, 16dp start indent).
 * 10 dummy apps.
 */
@Composable
fun TrendingNowSection(
    apps: List<AppItem>,
    installedApps: Set<String>,
    onInstallToggle: (AppItem) -> Unit,
    onAppClick: (AppItem) -> Unit,
    onMoreClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .testTag("trending_now_section")
    ) {
        // Section Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onMoreClick() }
                .padding(horizontal = 16.dp, vertical = 6.dp)
                .testTag("trending_now_header"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Trending now",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = PlayTextPrimary
            )

            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = "View all trending apps",
                tint = PlayTextSecondary,
                modifier = Modifier.size(24.dp)
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        // Numbered rows
        Column(
            modifier = Modifier.fillMaxWidth()
        ) {
            apps.forEachIndexed { index, app ->
                val isInstalled = installedApps.contains(app.packageName)
                val rank = index + 1

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(72.dp)
                        .clickable { onAppClick(app) }
                        .padding(horizontal = 16.dp)
                        .testTag("trending_row_$rank"),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // a) Rank number (bold, 18sp, grey #5F6368, 24dp width)
                    Text(
                        text = "$rank",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = PlayTextSecondary,
                        modifier = Modifier.width(24.dp),
                        textAlign = TextAlign.Start
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    // b) App icon (48dp, squircle, 8dp margin)
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(app.iconBackgroundColor)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = app.name.take(1),
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    // c & d & e) App name + dev + category tag + rating
                    Column(
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = app.name,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = PlayTextPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )

                        Spacer(modifier = Modifier.height(2.dp))

                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = app.developerName,
                                fontSize = 12.sp,
                                color = PlayTextSecondary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f, fill = false)
                            )

                            Spacer(modifier = Modifier.width(6.dp))

                            // Category tag (grey pill, 11sp)
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(PlaySearchBarBg)
                                    .padding(horizontal = 5.dp, vertical = 1.dp)
                            ) {
                                Text(
                                    text = app.category,
                                    fontSize = 10.sp,
                                    color = PlayTextSecondary
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(2.dp))

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "${app.rating}",
                                fontSize = 11.sp,
                                color = PlayTextSecondary
                            )
                            Spacer(modifier = Modifier.width(2.dp))
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = null,
                                tint = PlayStarYellow,
                                modifier = Modifier.size(10.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    // f) Green outlined "Install" pill button on far right
                    OutlinedButton(
                        onClick = { onInstallToggle(app) },
                        modifier = Modifier
                            .height(30.dp)
                            .testTag("trending_install_${app.packageName}"),
                        shape = RoundedCornerShape(15.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, PlayGreen),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = if (isInstalled) PlayGreenLight else Color.Transparent,
                            contentColor = PlayGreen
                        ),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 0.dp)
                    ) {
                        Text(
                            text = if (isInstalled) "Open" else "Install",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PlayGreen
                        )
                    }
                }

                if (index < apps.size - 1) {
                    HorizontalDivider(
                        color = PlayDivider,
                        thickness = 1.dp,
                        modifier = Modifier.padding(start = 60.dp, end = 16.dp)
                    )
                }
            }
        }
    }
}

/**
 * "CATEGORIES" GRID:
 * Heading: "Categories" (bold, 18sp) + ">".
 * 2-column grid of cards (80dp height, 12dp radius, tinted background):
 * • "Social" (blue #4285F4), "Entertainment" (red #EA4335), "Tools" (yellow #FBBC04),
 * • "Photography" (green #34A853), "Education" (purple #A142F4), "Finance" (teal #24C1E0),
 * • "Health" (pink #F538A0), "Shopping" (orange #FA903E).
 * Each card: colored icon (32dp) + label (bold, 14sp).
 * 8dp gap between items.
 */
@Composable
fun HomeCategoriesSection(
    categories: List<CategoryItem>,
    onCategoryClick: (CategoryItem) -> Unit,
    onMoreClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .testTag("home_categories_section")
    ) {
        // Section Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onMoreClick() }
                .padding(horizontal = 16.dp, vertical = 6.dp)
                .testTag("categories_header"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Categories",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = PlayTextPrimary
            )

            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = "View all categories",
                tint = PlayTextSecondary,
                modifier = Modifier.size(24.dp)
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        // 2-column grid arranged in rows of 2
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            categories.chunked(2).forEach { rowCategories ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    rowCategories.forEach { category ->
                        val baseColor = Color(category.color)
                        Card(
                            modifier = Modifier
                                .weight(1f)
                                .height(80.dp)
                                .clickable { onCategoryClick(category) }
                                .testTag("category_card_${category.name}"),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = baseColor.copy(alpha = 0.12f)
                            ),
                            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(horizontal = 14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(42.dp)
                                        .clip(CircleShape)
                                        .background(baseColor.copy(alpha = 0.2f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = category.icon,
                                        contentDescription = category.name,
                                        tint = baseColor,
                                        modifier = Modifier.size(24.dp)
                                    )
                                }

                                Spacer(modifier = Modifier.width(12.dp))

                                Text(
                                    text = category.name,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = PlayTextPrimary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }

                    // If row has only 1 item, fill remaining space
                    if (rowCategories.size == 1) {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}
