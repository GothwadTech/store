package com.example.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.HelpOutline
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material3.DividerDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.PlayBackground
import com.example.ui.theme.PlayBorder
import com.example.ui.theme.PlayGreen
import com.example.ui.theme.PlayTextPrimary
import com.example.ui.theme.PlayTextSecondary

/**
 * ProfileScreen for Gothwad Store.
 * Phase 1 layout + ready for Phase 11.
 */
@Composable
fun ProfileScreen(
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(PlayBackground)
            .padding(horizontal = 16.dp)
            .testTag("profile_screen_content")
    ) {
        // User Header
        item {
            Spacer(modifier = Modifier.height(16.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .background(PlayGreen)
                        .testTag("profile_avatar_large"),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "G",
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Gothwad User",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = PlayTextPrimary
                    )

                    Spacer(modifier = Modifier.height(2.dp))

                    Text(
                        text = "user@gothwadstore.com",
                        fontSize = 14.sp,
                        color = PlayTextSecondary
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedButton(
                        onClick = { /* Edit profile */ },
                        modifier = Modifier.height(32.dp),
                        shape = RoundedCornerShape(16.dp),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(
                            horizontal = 12.dp,
                            vertical = 0.dp
                        )
                    ) {
                        Text(
                            text = "Manage account",
                            fontSize = 12.sp,
                            color = PlayGreen,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider(color = PlayBorder.copy(alpha = 0.5f))
            Spacer(modifier = Modifier.height(8.dp))
        }

        // Settings list items
        item {
            ProfileMenuItem(
                icon = Icons.Outlined.Sync,
                title = "Manage apps & device",
                subtitle = "Updates available"
            )
            ProfileMenuItem(
                icon = Icons.Outlined.Notifications,
                title = "Notifications & offers"
            )
            ProfileMenuItem(
                icon = Icons.Outlined.CreditCard,
                title = "Payments & subscriptions"
            )
            ProfileMenuItem(
                icon = Icons.Outlined.Lock,
                title = "Play Protect & security"
            )
            ProfileMenuItem(
                icon = Icons.Outlined.Settings,
                title = "Settings",
                subtitle = "General, network, preferences"
            )
            ProfileMenuItem(
                icon = Icons.Outlined.HelpOutline,
                title = "Help & feedback"
            )

            Spacer(modifier = Modifier.height(24.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 96.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Gothwad Store v1.0.0",
                    fontSize = 12.sp,
                    color = PlayTextSecondary
                )
            }
        }
    }
}

@Composable
private fun ProfileMenuItem(
    icon: ImageVector,
    title: String,
    subtitle: String? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp)
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = PlayTextSecondary,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = PlayTextPrimary
            )
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    fontSize = 12.sp,
                    color = PlayTextSecondary
                )
            }
        }
        Icon(
            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = PlayTextSecondary,
            modifier = Modifier.size(20.dp)
        )
    }
}
