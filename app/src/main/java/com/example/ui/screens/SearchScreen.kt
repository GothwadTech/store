package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.PlayBackground
import com.example.ui.theme.PlayGreen
import com.example.ui.theme.PlayTextPrimary
import com.example.ui.theme.PlayTextSecondary

/**
 * SearchScreen for Gothwad Store.
 * In Search Tab:
 * Top bar only has the search bar (no title, no profile avatar).
 * Content shows Trending searches and Recent searches.
 */
@Composable
fun SearchScreen(
    searchQuery: String,
    onQueryChange: (String) -> Unit,
    onSearchTriggered: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val trendingSearches = remember {
        listOf(
            "WhatsApp",
            "Instagram",
            "BGMI",
            "Spotify",
            "YouTube",
            "Telegram",
            "Netflix",
            "PhonePe"
        )
    }

    var recentSearches by remember {
        mutableStateOf(listOf("VLC Player", "Camera apps", "Photo editor"))
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(PlayBackground)
            .padding(horizontal = 16.dp)
            .testTag("search_screen_content")
    ) {
        if (searchQuery.isNotEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Outlined.Search,
                            contentDescription = "Search",
                            tint = PlayGreen,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Searching for \"$searchQuery\"",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Medium,
                            color = PlayTextPrimary
                        )
                    }
                }
            }
        } else {
            // Trending Searches Section
            item {
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Outlined.TrendingUp,
                        contentDescription = "Trending",
                        tint = PlayGreen,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Trending searches",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = PlayTextPrimary
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            items(trendingSearches) { query ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            onQueryChange(query)
                            onSearchTriggered(query)
                        }
                        .padding(vertical = 12.dp)
                        .testTag("trending_query_$query"),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Search,
                        contentDescription = null,
                        tint = PlayTextSecondary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                    Text(
                        text = query,
                        fontSize = 15.sp,
                        color = PlayTextPrimary
                    )
                }
            }

            // Recent Searches Section
            if (recentSearches.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(16.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Recent searches",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = PlayTextPrimary
                        )
                        Text(
                            text = "Clear all",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PlayGreen,
                            modifier = Modifier
                                .clickable { recentSearches = emptyList() }
                                .padding(4.dp)
                                .testTag("clear_recent_searches_button")
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }

                items(recentSearches) { query ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onQueryChange(query)
                                onSearchTriggered(query)
                            }
                            .padding(vertical = 8.dp)
                            .testTag("recent_query_$query"),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Outlined.History,
                                contentDescription = null,
                                tint = PlayTextSecondary,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(16.dp))
                            Text(
                                text = query,
                                fontSize = 15.sp,
                                color = PlayTextPrimary
                            )
                        }
                        IconButton(
                            onClick = { recentSearches = recentSearches - query },
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Remove search",
                                tint = PlayTextSecondary,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
