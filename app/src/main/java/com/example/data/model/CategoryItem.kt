package com.example.data.model

import androidx.compose.ui.graphics.vector.ImageVector

data class CategoryItem(
    val name: String,
    val color: Long,
    val icon: ImageVector
)

data class GameItem(
    val id: String,
    val name: String,
    val rating: Float,
    val size: String = "150 MB",
    val primaryColor: Long,
    val secondaryColor: Long,
    val developer: String = "Game Studio",
    val iconColor: Long = primaryColor,
    val downloads: String = "50M+",
    val inAppPurchases: Boolean = true
)
