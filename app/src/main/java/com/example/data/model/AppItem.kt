package com.example.data.model

import androidx.compose.ui.graphics.Color

data class AppItem(
    val packageName: String,
    val name: String,
    val developerName: String,
    val category: String,
    val rating: Float,
    val ratingCount: Int = 12000,
    val downloadCount: String = "10M+",
    val fileSizeMb: Float = 32.5f,
    val description: String = "",
    val iconUrl: String = "",
    val iconBackgroundColor: Long = 0xFF01875FL,
    val isFoss: Boolean = false,
    val source: String = "store",
    val isInstalled: Boolean = false,
    val isDownloading: Boolean = false,
    val downloadProgress: Float = 0f
)
