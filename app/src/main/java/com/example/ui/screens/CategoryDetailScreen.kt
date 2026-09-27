package com.example.ui.screens

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import com.example.ui.theme.PlayBackground
import com.example.ui.theme.PlayBorder
import com.example.ui.theme.PlayDivider
import com.example.ui.theme.PlayGreen
import com.example.ui.theme.PlayGreenLight
import com.example.ui.theme.PlayStarYellow
import com.example.ui.theme.PlayTextPrimary
import com.example.ui.theme.PlayTextSecondary

/**
 * CategoryDetailScreen
 * - Top: back arrow + category name as title
 * - Filter chips: "Top free", "Top grossing", "New"
 * - Numbered app list (20 dummy apps, same row style)
 * - LazyColumn, 80dp bottom padding
 * - BackHandler to return to categories list
 */
@Composable
fun CategoryDetailScreen(
    categoryName: String,
    onBackClick: () -> Unit,
    onAppClick: (AppItem) -> Unit = {},
    modifier: Modifier = Modifier
) {
    BackHandler { onBackClick() }

    var selectedFilter by remember { mutableStateOf("Top free") }
    var installedApps by remember { mutableStateOf(setOf<String>()) }
    val apps = remember(categoryName, selectedFilter) {
        DummyStoreData.getCategoryApps(categoryName)
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(PlayBackground)
            .testTag("category_detail_screen")
    ) {
        // Top Bar: Back arrow + Category name title
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = onBackClick,
                modifier = Modifier.testTag("category_detail_back_button")
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = PlayTextPrimary
                )
            }

            Text(
                text = categoryName,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = PlayTextPrimary,
                modifier = Modifier.padding(start = 8.dp)
            )
        }

        // Filter chips: "Top free", "Top grossing", "New"
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            DummyStoreData.categoryFilterChips.forEach { filter ->
                val isSelected = filter == selectedFilter
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
                        .clickable { selectedFilter = filter }
                        .padding(horizontal = 14.dp)
                        .testTag("category_filter_$filter"),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = filter,
                        color = if (isSelected) PlayGreen else PlayTextSecondary,
                        fontSize = 13.sp,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        // Numbered 20 app list
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .testTag("category_apps_list"),
            contentPadding = PaddingValues(bottom = 80.dp)
        ) {
            itemsIndexed(apps, key = { _, app -> app.packageName }) { index, app ->
                val rank = index + 1
                val isInstalled = installedApps.contains(app.packageName)

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(72.dp)
                        .clickable { onAppClick(app) }
                        .padding(horizontal = 16.dp)
                        .testTag("category_app_row_$rank"),
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

                    // App icon
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

                    // App Name & Details
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

                    // Install button
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
                            .testTag("category_install_${app.packageName}"),
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
