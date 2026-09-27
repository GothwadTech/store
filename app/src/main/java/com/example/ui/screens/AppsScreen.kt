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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Star
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
import com.example.ui.theme.PlayBackground
import com.example.ui.theme.PlayBorder
import com.example.ui.theme.PlayDivider
import com.example.ui.theme.PlayGreen
import com.example.ui.theme.PlayGreenLight
import com.example.ui.theme.PlaySearchBarBg
import com.example.ui.theme.PlayStarYellow
import com.example.ui.theme.PlayTextPrimary
import com.example.ui.theme.PlayTextSecondary

/**
 * AppsScreen for Gothwad Store (Phase 4).
 * - Filter chips: "For you", "Top charts", "Categories", "Early access"
 * - Top charts segmented toggle: "Top free" | "Top grossing" | "Trending"
 * - Numbered list of 15 apps
 * - Browse by category 2-column grid (16 categories)
 * - Transitions to CategoryDetailScreen when a category is tapped
 */
@Composable
fun AppsScreen(
    onAppClick: (AppItem) -> Unit = {},
    modifier: Modifier = Modifier
) {
    var selectedCategoryForDetail by remember { mutableStateOf<String?>(null) }

    if (selectedCategoryForDetail != null) {
        CategoryDetailScreen(
            categoryName = selectedCategoryForDetail!!,
            onBackClick = { selectedCategoryForDetail = null },
            onAppClick = onAppClick
        )
    } else {
        var selectedChip by remember { mutableStateOf("For you") }
        var selectedChartToggle by remember { mutableStateOf("Top free") }
        var installedApps by remember { mutableStateOf(setOf<String>()) }

        val chartApps = remember(selectedChartToggle) {
            when (selectedChartToggle) {
                "Top grossing" -> DummyStoreData.topGrossingAppsChart
                "Trending" -> DummyStoreData.trendingAppsChart
                else -> DummyStoreData.topFreeAppsChart
            }
        }

        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .background(PlayBackground)
                .testTag("apps_screen_content"),
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
                    DummyStoreData.appsFilterChips.forEach { chipName ->
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
                                .testTag("apps_chip_$chipName"),
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

            // 2. TOP CHARTS SECTION
            if (selectedChip != "Categories") {
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Top charts",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = PlayTextPrimary,
                        modifier = Modifier.padding(horizontal = 16.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    // Segmented Toggle Row: "Top free" | "Top grossing" | "Trending"
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf("Top free", "Top grossing", "Trending").forEach { toggleLabel ->
                            val isActive = toggleLabel == selectedChartToggle
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(if (isActive) PlayGreen else PlaySearchBarBg)
                                    .clickable { selectedChartToggle = toggleLabel }
                                    .padding(horizontal = 16.dp, vertical = 8.dp)
                                    .testTag("chart_toggle_$toggleLabel"),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = toggleLabel,
                                    fontSize = 13.sp,
                                    fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium,
                                    color = if (isActive) Color.White else PlayTextSecondary
                                )
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                }

                // Numbered list of 15 dummy apps
                itemsIndexed(chartApps, key = { index, app -> "${app.packageName}_$index" }) { index, app ->
                    val rank = index + 1
                    val isInstalled = installedApps.contains(app.packageName)

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(72.dp)
                            .clickable { onAppClick(app) }
                            .padding(horizontal = 16.dp)
                            .testTag("chart_app_row_$rank"),
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

                        // App icon (48dp squircle)
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

                        // App Name, Developer, Downloads, Rating
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

                            Text(
                                text = app.developerName,
                                fontSize = 12.sp,
                                color = PlayTextSecondary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )

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
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "• ${app.downloadCount}",
                                    fontSize = 11.sp,
                                    color = PlayTextSecondary
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        // Green "Install" button
                        OutlinedButton(
                            onClick = {
                                installedApps = if (isInstalled) {
                                    installedApps - app.packageName
                                } else {
                                    installedApps + app.packageName
                                }
                            },
                            modifier = Modifier
                                .height(30.dp)
                                .testTag("chart_install_${app.packageName}"),
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

                    if (index < chartApps.size - 1) {
                        HorizontalDivider(
                            color = PlayDivider,
                            thickness = 1.dp,
                            modifier = Modifier.padding(start = 60.dp, end = 16.dp)
                        )
                    }
                }
            }

            // 3. CATEGORIES SECTION (Shown at bottom or when "Categories" chip is selected)
            item {
                Spacer(modifier = Modifier.height(24.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Browse by category",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = PlayTextPrimary
                    )

                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                        contentDescription = "View categories",
                        tint = PlayTextSecondary,
                        modifier = Modifier.size(24.dp)
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                // 2-column grid of 16 categories
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    DummyStoreData.allAppCategories.chunked(2).forEach { rowCategories ->
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
                                        .clickable { selectedCategoryForDetail = category.name }
                                        .testTag("app_category_${category.name}"),
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
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}
