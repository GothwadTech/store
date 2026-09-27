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
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import com.example.ui.theme.PlayBorder
import com.example.ui.theme.PlayDivider
import com.example.ui.theme.PlayGreen
import com.example.ui.theme.PlayGreenLight
import com.example.ui.theme.PlayStarYellow
import com.example.ui.theme.PlayTextPrimary
import com.example.ui.theme.PlayTextSecondary

/**
 * GamesScreen for Gothwad Store (Phase 5).
 * - Filter chips: "For you", "Top charts", "Premium", "Categories"
 * - Featured game banner (200dp, dark gradient, 72dp icon, rating, install button, "In-app purchases")
 * - "Top free games" horizontal scroll (160x200dp cards with top 60% screenshot + bottom 40% info)
 * - "New & updated games" horizontal scroll (same card style)
 * - "Top games" numbered list (10 dummy games with ranks and dividers)
 * - "Game categories" 2-column grid (Action, Puzzle, Racing, RPG, Strategy, Casual, Sports, Simulation, Adventure, Arcade)
 * - LazyColumn with 20dp gap between sections and 80dp bottom padding
 */
@Composable
fun GamesScreen(
    onGameClick: (GameItem) -> Unit = {},
    modifier: Modifier = Modifier
) {
    var selectedChip by remember { mutableStateOf("For you") }
    var installedGames by remember { mutableStateOf(setOf<String>()) }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(PlayBackground)
            .testTag("games_screen_content"),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        // 1. FILTER CHIPS ROW
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                DummyStoreData.gamesFilterChips.forEach { chipName ->
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
                            .clickable { selectedChip = chipName }
                            .padding(horizontal = 14.dp)
                            .testTag("games_chip_$chipName"),
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

        // 2. FEATURED GAME BANNER (full width, 200dp, 12dp radius, 16dp margin)
        item {
            Spacer(modifier = Modifier.height(12.dp))
            FeaturedGameBanner(
                game = DummyStoreData.featuredGame,
                isInstalled = installedGames.contains(DummyStoreData.featuredGame.id),
                onInstallClick = {
                    installedGames = if (installedGames.contains(DummyStoreData.featuredGame.id)) {
                        installedGames - DummyStoreData.featuredGame.id
                    } else {
                        installedGames + DummyStoreData.featuredGame.id
                    }
                },
                onBannerClick = { onGameClick(DummyStoreData.featuredGame) }
            )
        }

        // 3. "TOP FREE GAMES" HORIZONTAL SCROLL (160x200dp cards)
        item {
            Spacer(modifier = Modifier.height(20.dp))
            GameCarouselSection(
                title = "Top free games",
                games = DummyStoreData.topFreeGames,
                installedGames = installedGames,
                onInstallToggle = { game ->
                    installedGames = if (installedGames.contains(game.id)) {
                        installedGames - game.id
                    } else {
                        installedGames + game.id
                    }
                },
                onGameClick = onGameClick,
                testTagPrefix = "top_free_games"
            )
        }

        // 4. "NEW & UPDATED GAMES" HORIZONTAL SCROLL (160x200dp cards)
        item {
            Spacer(modifier = Modifier.height(20.dp))
            GameCarouselSection(
                title = "New & updated games",
                games = DummyStoreData.newUpdatedGames,
                installedGames = installedGames,
                onInstallToggle = { game ->
                    installedGames = if (installedGames.contains(game.id)) {
                        installedGames - game.id
                    } else {
                        installedGames + game.id
                    }
                },
                onGameClick = onGameClick,
                testTagPrefix = "new_updated_games"
            )
        }

        // 5. "TOP GAMES" NUMBERED LIST (10 dummy games)
        item {
            Spacer(modifier = Modifier.height(20.dp))
            TopGamesNumberedList(
                games = DummyStoreData.topGamesChart,
                installedGames = installedGames,
                onInstallToggle = { game ->
                    installedGames = if (installedGames.contains(game.id)) {
                        installedGames - game.id
                    } else {
                        installedGames + game.id
                    }
                },
                onGameClick = onGameClick
            )
        }

        // 6. GAME CATEGORIES GRID (10 categories)
        item {
            Spacer(modifier = Modifier.height(20.dp))
            GameCategoriesSection(
                categories = DummyStoreData.gameCategories,
                onCategoryClick = { /* Open Game Category */ }
            )
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

/**
 * FEATURED GAME BANNER (full width, 200dp, 12dp radius, 16dp margin)
 * Dark gradient background.
 * Game icon (72dp, rounded) left side.
 * Game name (white, bold, 22sp) + developer (white, 13sp).
 * Rating (white, 13sp).
 * Green filled "Install" pill button bottom-right.
 * "In-app purchases" small text (white, 10sp).
 */
@Composable
fun FeaturedGameBanner(
    game: GameItem,
    isInstalled: Boolean,
    onInstallClick: () -> Unit,
    onBannerClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .height(200.dp)
            .padding(horizontal = 16.dp)
            .clickable { onBannerClick() }
            .testTag("featured_game_banner"),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.linearGradient(
                        colors = listOf(Color(0xFF1A1A2E), Color(0xFF16213E), Color(0xFF0F3460))
                    )
                )
                .padding(16.dp)
        ) {
            // Left Content: Game Icon (72dp) + Info
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopStart),
                verticalAlignment = Alignment.Top
            ) {
                // Game Icon (72dp, rounded 16dp)
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(game.primaryColor))
                        .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "🎮",
                        fontSize = 34.sp
                    )
                }

                Spacer(modifier = Modifier.width(14.dp))

                Column(
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = game.name,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    Spacer(modifier = Modifier.height(2.dp))

                    Text(
                        text = game.developer,
                        fontSize = 13.sp,
                        color = Color.White.copy(alpha = 0.85f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${game.rating}",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.width(3.dp))
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            tint = PlayStarYellow,
                            modifier = Modifier.size(13.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "• ${game.size}",
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.7f)
                        )
                    }
                }
            }

            // Bottom Row: "In-app purchases" on left, Green filled "Install" pill button bottom-right
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Contains ads • In-app purchases",
                    fontSize = 10.sp,
                    color = Color.White.copy(alpha = 0.65f)
                )

                Button(
                    onClick = onInstallClick,
                    modifier = Modifier
                        .height(34.dp)
                        .testTag("featured_game_install"),
                    shape = RoundedCornerShape(17.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = PlayGreen,
                        contentColor = Color.White
                    ),
                    contentPadding = PaddingValues(horizontal = 18.dp, vertical = 0.dp)
                ) {
                    Text(
                        text = if (isInstalled) "Open" else "Install",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }
        }
    }
}

/**
 * Game Carousel Section (Cards 160x200dp, 12dp radius)
 * Top 60%: screenshot placeholder (colored rectangle)
 * Bottom 40%: white bg, app icon (40dp overlapping screenshot), game name (bold 13sp), rating (11sp), size, green "Install" button.
 */
@Composable
fun GameCarouselSection(
    title: String,
    games: List<GameItem>,
    installedGames: Set<String>,
    onInstallToggle: (GameItem) -> Unit,
    onGameClick: (GameItem) -> Unit,
    testTagPrefix: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .testTag("${testTagPrefix}_section")
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = title,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = PlayTextPrimary
            )

            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = "View more",
                tint = PlayTextSecondary,
                modifier = Modifier.size(24.dp)
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        LazyRow(
            modifier = Modifier
                .fillMaxWidth()
                .testTag("${testTagPrefix}_row"),
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(games, key = { it.id }) { game ->
                val isInstalled = installedGames.contains(game.id)
                Card(
                    modifier = Modifier
                        .width(160.dp)
                        .height(200.dp)
                        .clickable { onGameClick(game) }
                        .testTag("${testTagPrefix}_card_${game.id}"),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = PlayBackground),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(
                        modifier = Modifier.fillMaxSize()
                    ) {
                        // Top 60%: Screenshot placeholder (120dp)
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(115.dp)
                                .background(
                                    Brush.linearGradient(
                                        colors = listOf(Color(game.primaryColor), Color(game.secondaryColor))
                                    )
                                )
                        ) {
                            Text(
                                text = "🎮",
                                fontSize = 28.sp,
                                modifier = Modifier
                                    .align(Alignment.Center)
                                    .padding(bottom = 8.dp)
                            )

                            // App Icon (40dp) overlapping screenshot at bottom-start
                            Box(
                                modifier = Modifier
                                    .align(Alignment.BottomStart)
                                    .padding(start = 10.dp)
                                    .offset(y = 12.dp)
                                    .size(40.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(Color(game.iconColor))
                                    .border(1.5.dp, Color.White, RoundedCornerShape(10.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = game.name.take(1),
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }
                        }

                        // Bottom 40%: Info area (85dp)
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f)
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Spacer(modifier = Modifier.height(10.dp))
                                Text(
                                    text = game.name,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = PlayTextPrimary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )

                                Spacer(modifier = Modifier.height(1.dp))

                                Row(
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "${game.rating}",
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
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "• ${game.size}",
                                        fontSize = 10.sp,
                                        color = PlayTextSecondary
                                    )
                                }
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End
                            ) {
                                OutlinedButton(
                                    onClick = { onInstallToggle(game) },
                                    modifier = Modifier
                                        .height(26.dp)
                                        .testTag("${testTagPrefix}_install_${game.id}"),
                                    shape = RoundedCornerShape(13.dp),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, PlayGreen),
                                    colors = ButtonDefaults.outlinedButtonColors(
                                        containerColor = if (isInstalled) PlayGreenLight else Color.Transparent,
                                        contentColor = PlayGreen
                                    ),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 0.dp)
                                ) {
                                    Text(
                                        text = if (isInstalled) "Open" else "Install",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = PlayGreen
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
 * Top Games Numbered List (10 games)
 * Same row style as Apps tab: rank number, 48dp squircle icon, name, developer, size/downloads, rating, install button, divider.
 */
@Composable
fun TopGamesNumberedList(
    games: List<GameItem>,
    installedGames: Set<String>,
    onInstallToggle: (GameItem) -> Unit,
    onGameClick: (GameItem) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .testTag("top_games_list_section")
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Top games",
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

        Spacer(modifier = Modifier.height(4.dp))

        Column(modifier = Modifier.fillMaxWidth()) {
            games.forEachIndexed { index, game ->
                val rank = index + 1
                val isInstalled = installedGames.contains(game.id)

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(72.dp)
                        .clickable { onGameClick(game) }
                        .padding(horizontal = 16.dp)
                        .testTag("top_game_row_$rank"),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Rank number
                    Text(
                        text = "$rank",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = PlayTextSecondary,
                        modifier = Modifier.width(24.dp),
                        textAlign = TextAlign.Start
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    // Game icon (48dp squircle)
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(game.primaryColor)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = game.name.take(1),
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    // Title, Dev, Size, Rating
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = game.name,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = PlayTextPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )

                        Spacer(modifier = Modifier.height(2.dp))

                        Text(
                            text = game.developer,
                            fontSize = 12.sp,
                            color = PlayTextSecondary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )

                        Spacer(modifier = Modifier.height(2.dp))

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "${game.rating}",
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
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "• ${game.size}",
                                fontSize = 11.sp,
                                color = PlayTextSecondary
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    OutlinedButton(
                        onClick = { onInstallToggle(game) },
                        modifier = Modifier
                            .height(30.dp)
                            .testTag("top_game_install_${game.id}"),
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

                if (index < games.size - 1) {
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
 * Game Categories Section (10 categories: Action, Puzzle, Racing, RPG, Strategy, Casual, Sports, Simulation, Adventure, Arcade)
 */
@Composable
fun GameCategoriesSection(
    categories: List<CategoryItem>,
    onCategoryClick: (CategoryItem) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .testTag("game_categories_section")
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Game categories",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = PlayTextPrimary
            )

            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = "View game categories",
                tint = PlayTextSecondary,
                modifier = Modifier.size(24.dp)
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

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
                                .testTag("game_category_${category.name}"),
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

                    if (rowCategories.size == 1) {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}
