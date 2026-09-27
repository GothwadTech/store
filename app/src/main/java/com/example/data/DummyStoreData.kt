package com.example.data

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.Build
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.DirectionsCar
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.Extension
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FitnessCenter
import androidx.compose.material.icons.outlined.FlashOn
import androidx.compose.material.icons.outlined.Flight
import androidx.compose.material.icons.outlined.FlightTakeoff
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.Movie
import androidx.compose.material.icons.outlined.MusicNote
import androidx.compose.material.icons.outlined.Newspaper
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material.icons.outlined.PlayCircle
import androidx.compose.material.icons.outlined.Psychology
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.SentimentSatisfied
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.SportsSoccer
import androidx.compose.material.icons.outlined.VideogameAsset
import com.example.data.model.AppItem
import com.example.data.model.CategoryItem
import com.example.data.model.GameItem

object DummyStoreData {

    val filterChips = listOf(
        "For you",
        "Top charts",
        "Categories",
        "Editors' choice",
        "Early access"
    )

    val appsFilterChips = listOf(
        "For you",
        "Top charts",
        "Categories",
        "Early access"
    )

    val gamesFilterChips = listOf(
        "For you",
        "Top charts",
        "Premium",
        "Categories"
    )

    val categoryFilterChips = listOf(
        "Top free",
        "Top grossing",
        "New"
    )

    val suggestedApps = listOf(
        AppItem(
            packageName = "com.whatsapp",
            name = "WhatsApp Messenger",
            developerName = "WhatsApp LLC",
            category = "Communication",
            rating = 4.3f,
            ratingCount = 184000000,
            downloadCount = "5B+",
            fileSizeMb = 48.2f,
            description = "Simple. Reliable. Private.",
            iconBackgroundColor = 0xFF25D366L
        ),
        AppItem(
            packageName = "com.spotify.music",
            name = "Spotify: Music and Podcasts",
            developerName = "Spotify AB",
            category = "Music & Audio",
            rating = 4.4f,
            ratingCount = 32000000,
            downloadCount = "1B+",
            fileSizeMb = 35.8f,
            description = "Discover new music, podcasts and listen to your favorite artists.",
            iconBackgroundColor = 0xFF1DB954L
        ),
        AppItem(
            packageName = "com.instagram.android",
            name = "Instagram",
            developerName = "Instagram",
            category = "Social",
            rating = 4.2f,
            ratingCount = 150000000,
            downloadCount = "5B+",
            fileSizeMb = 55.4f,
            description = "Connect with friends, share what you're up to, or see what's new from others.",
            iconBackgroundColor = 0xFFE1306CL
        ),
        AppItem(
            packageName = "org.videolan.vlc",
            name = "VLC for Android",
            developerName = "Videolabs",
            category = "Video Players & Editors",
            rating = 4.5f,
            ratingCount = 1800000,
            downloadCount = "100M+",
            fileSizeMb = 33.1f,
            description = "The best open-source video and music player. Fast and versatile.",
            iconBackgroundColor = 0xFFFF8800L,
            isFoss = true,
            source = "store"
        ),
        AppItem(
            packageName = "com.kiloo.subwaysurf",
            name = "Subway Surfers",
            developerName = "SYBO Games",
            category = "Arcade",
            rating = 4.6f,
            ratingCount = 42000000,
            downloadCount = "1B+",
            fileSizeMb = 92.0f,
            description = "DASH as fast as you can! DODGE the oncoming trains!",
            iconBackgroundColor = 0xFF0288D1L
        ),
        AppItem(
            packageName = "com.duolingo",
            name = "Duolingo: Language Lessons",
            developerName = "Duolingo",
            category = "Education",
            rating = 4.7f,
            ratingCount = 21000000,
            downloadCount = "500M+",
            fileSizeMb = 42.6f,
            description = "Learn Spanish, French, German, Italian, English and more.",
            iconBackgroundColor = 0xFF58CC02L
        )
    )

    // Top Free Apps (8 dummy apps for Home Tab)
    val topFreeApps = listOf(
        AppItem(
            packageName = "com.zhiliaoapp.musically",
            name = "TikTok",
            developerName = "TikTok Pte. Ltd.",
            category = "Entertainment",
            rating = 4.4f,
            downloadCount = "1B+",
            iconBackgroundColor = 0xFF000000L
        ),
        AppItem(
            packageName = "com.snapchat.android",
            name = "Snapchat",
            developerName = "Snap Inc",
            category = "Social",
            rating = 4.1f,
            downloadCount = "1B+",
            iconBackgroundColor = 0xFFFFFC00L
        ),
        AppItem(
            packageName = "org.telegram.messenger",
            name = "Telegram",
            developerName = "Telegram FZ-LLC",
            category = "Communication",
            rating = 4.5f,
            downloadCount = "1B+",
            iconBackgroundColor = 0xFF2AABEEL
        ),
        AppItem(
            packageName = "com.whatsapp.w4b",
            name = "WhatsApp Business",
            developerName = "WhatsApp LLC",
            category = "Business",
            rating = 4.4f,
            downloadCount = "1B+",
            iconBackgroundColor = 0xFF128C7EL
        ),
        AppItem(
            packageName = "com.lemon.lvoverseas",
            name = "CapCut - Video Editor",
            developerName = "Bytedance Pte. Ltd.",
            category = "Video Players",
            rating = 4.4f,
            downloadCount = "500M+",
            iconBackgroundColor = 0xFF212121L
        ),
        AppItem(
            packageName = "com.phonepe.app",
            name = "PhonePe: Secure UPI & Payments",
            developerName = "PhonePe",
            category = "Finance",
            rating = 4.4f,
            downloadCount = "500M+",
            iconBackgroundColor = 0xFF5F259FL
        ),
        AppItem(
            packageName = "com.pinterest",
            name = "Pinterest",
            developerName = "Pinterest",
            category = "Lifestyle",
            rating = 4.5f,
            downloadCount = "500M+",
            iconBackgroundColor = 0xFFE60023L
        ),
        AppItem(
            packageName = "com.truecaller",
            name = "Truecaller: Caller ID & Block",
            developerName = "Truecaller",
            category = "Communication",
            rating = 4.3f,
            downloadCount = "1B+",
            iconBackgroundColor = 0xFF0077FAL
        )
    )

    // Recommended Games (6 games for Home Tab)
    val recommendedGames = listOf(
        GameItem(
            id = "com.pubg.imobile",
            name = "BGMI",
            rating = 4.3f,
            size = "750 MB",
            primaryColor = 0xFFD84315L,
            secondaryColor = 0xFF212121L,
            developer = "KRAFTON, Inc.",
            downloads = "100M+"
        ),
        GameItem(
            id = "com.dts.freefiremax",
            name = "Free Fire MAX",
            rating = 4.2f,
            size = "620 MB",
            primaryColor = 0xFFC2185BL,
            secondaryColor = 0xFF311B92L,
            developer = "Garena International",
            downloads = "100M+"
        ),
        GameItem(
            id = "com.king.candycrushsaga",
            name = "Candy Crush Saga",
            rating = 4.6f,
            size = "88 MB",
            primaryColor = 0xFFFF4081L,
            secondaryColor = 0xFFFFD54FL,
            developer = "King",
            downloads = "1B+"
        ),
        GameItem(
            id = "com.gameloft.android.ANMP.GloftA9HM",
            name = "Asphalt 9: Legends",
            rating = 4.5f,
            size = "2.1 GB",
            primaryColor = 0xFF0D47A1L,
            secondaryColor = 0xFF00E5FFL,
            developer = "Gameloft SE",
            downloads = "100M+"
        ),
        GameItem(
            id = "com.supercell.clashofclans",
            name = "Clash of Clans",
            rating = 4.5f,
            size = "290 MB",
            primaryColor = 0xFFE65100L,
            secondaryColor = 0xFFFFB300L,
            developer = "Supercell",
            downloads = "500M+"
        ),
        GameItem(
            id = "com.roblox.client",
            name = "Roblox",
            rating = 4.4f,
            size = "180 MB",
            primaryColor = 0xFF37474FL,
            secondaryColor = 0xFF263238L,
            developer = "Roblox Corporation",
            downloads = "500M+"
        )
    )

    // Trending Now Numbered List (10 apps for Home Tab)
    val trendingApps = listOf(
        AppItem(
            packageName = "com.whatsapp",
            name = "WhatsApp Messenger",
            developerName = "WhatsApp LLC",
            category = "Communication",
            rating = 4.3f,
            downloadCount = "5B+",
            iconBackgroundColor = 0xFF25D366L
        ),
        AppItem(
            packageName = "com.instagram.android",
            name = "Instagram",
            developerName = "Instagram",
            category = "Social",
            rating = 4.2f,
            downloadCount = "5B+",
            iconBackgroundColor = 0xFFE1306CL
        ),
        AppItem(
            packageName = "com.google.android.youtube",
            name = "YouTube",
            developerName = "Google LLC",
            category = "Video Players",
            rating = 4.1f,
            downloadCount = "10B+",
            iconBackgroundColor = 0xFFFF0000L
        ),
        AppItem(
            packageName = "com.spotify.music",
            name = "Spotify: Music and Podcasts",
            developerName = "Spotify AB",
            category = "Music & Audio",
            rating = 4.4f,
            downloadCount = "1B+",
            iconBackgroundColor = 0xFF1DB954L
        ),
        AppItem(
            packageName = "com.netflix.mediaclient",
            name = "Netflix",
            developerName = "Netflix, Inc.",
            category = "Entertainment",
            rating = 4.2f,
            downloadCount = "1B+",
            iconBackgroundColor = 0xFFE50914L
        ),
        AppItem(
            packageName = "com.snapchat.android",
            name = "Snapchat",
            developerName = "Snap Inc",
            category = "Social",
            rating = 4.1f,
            downloadCount = "1B+",
            iconBackgroundColor = 0xFFFFFC00L
        ),
        AppItem(
            packageName = "org.telegram.messenger",
            name = "Telegram",
            developerName = "Telegram FZ-LLC",
            category = "Communication",
            rating = 4.5f,
            downloadCount = "1B+",
            iconBackgroundColor = 0xFF2AABEEL
        ),
        AppItem(
            packageName = "com.amazon.mShop.android.shopping",
            name = "Amazon Shopping",
            developerName = "Amazon Mobile LLC",
            category = "Shopping",
            rating = 4.3f,
            downloadCount = "500M+",
            iconBackgroundColor = 0xFFFF9900L
        ),
        AppItem(
            packageName = "com.google.android.apps.nbu.paisa.user",
            name = "Google Pay",
            developerName = "Google LLC",
            category = "Finance",
            rating = 4.5f,
            downloadCount = "1B+",
            iconBackgroundColor = 0xFF4285F4L
        ),
        AppItem(
            packageName = "com.openai.chatgpt",
            name = "ChatGPT",
            developerName = "OpenAI",
            category = "Productivity",
            rating = 4.7f,
            downloadCount = "100M+",
            iconBackgroundColor = 0xFF10A37FL
        )
    )

    // Categories Grid (8 categories for Home Tab)
    val homeCategories = listOf(
        CategoryItem("Social", 0xFF4285F4L, Icons.Outlined.People),
        CategoryItem("Entertainment", 0xFFEA4335L, Icons.Outlined.Movie),
        CategoryItem("Tools", 0xFFFBBC04L, Icons.Outlined.Build),
        CategoryItem("Photography", 0xFF34A853L, Icons.Outlined.PhotoCamera),
        CategoryItem("Education", 0xFFA142F4L, Icons.Outlined.School),
        CategoryItem("Finance", 0xFF24C1E0L, Icons.Outlined.AccountBalance),
        CategoryItem("Health", 0xFFF538A0L, Icons.Outlined.Favorite),
        CategoryItem("Shopping", 0xFFFA903EL, Icons.Outlined.ShoppingCart)
    )

    // ==========================================
    // PHASE 4: APPS TAB DATA
    // ==========================================

    // Top Free Apps (15 apps for Top Charts in Apps Tab)
    val topFreeAppsChart = listOf(
        AppItem("com.whatsapp", "WhatsApp Messenger", "WhatsApp LLC", "Communication", 4.3f, downloadCount = "5B+", iconBackgroundColor = 0xFF25D366L),
        AppItem("com.instagram.android", "Instagram", "Instagram", "Social", 4.2f, downloadCount = "5B+", iconBackgroundColor = 0xFFE1306CL),
        AppItem("com.zhiliaoapp.musically", "TikTok", "TikTok Pte. Ltd.", "Entertainment", 4.4f, downloadCount = "1B+", iconBackgroundColor = 0xFF000000L),
        AppItem("com.snapchat.android", "Snapchat", "Snap Inc", "Social", 4.1f, downloadCount = "1B+", iconBackgroundColor = 0xFFFFFC00L),
        AppItem("org.telegram.messenger", "Telegram", "Telegram FZ-LLC", "Communication", 4.5f, downloadCount = "1B+", iconBackgroundColor = 0xFF2AABEEL),
        AppItem("com.spotify.music", "Spotify: Music and Podcasts", "Spotify AB", "Music & Audio", 4.4f, downloadCount = "1B+", iconBackgroundColor = 0xFF1DB954L),
        AppItem("com.phonepe.app", "PhonePe: Payments & Recharge", "PhonePe", "Finance", 4.4f, downloadCount = "500M+", iconBackgroundColor = 0xFF5F259FL),
        AppItem("com.google.android.youtube", "YouTube", "Google LLC", "Video Players", 4.1f, downloadCount = "10B+", iconBackgroundColor = 0xFFFF0000L),
        AppItem("com.lemon.lvoverseas", "CapCut - Video Editor", "Bytedance Pte. Ltd.", "Video Players", 4.4f, downloadCount = "500M+", iconBackgroundColor = 0xFF212121L),
        AppItem("com.amazon.mShop.android.shopping", "Amazon Shopping", "Amazon Mobile LLC", "Shopping", 4.3f, downloadCount = "500M+", iconBackgroundColor = 0xFFFF9900L),
        AppItem("com.google.android.apps.nbu.paisa.user", "Google Pay: Save & Pay", "Google LLC", "Finance", 4.5f, downloadCount = "1B+", iconBackgroundColor = 0xFF4285F4L),
        AppItem("com.truecaller", "Truecaller: Caller ID & Block", "Truecaller", "Communication", 4.3f, downloadCount = "1B+", iconBackgroundColor = 0xFF0077FAL),
        AppItem("com.pinterest", "Pinterest", "Pinterest", "Lifestyle", 4.5f, downloadCount = "500M+", iconBackgroundColor = 0xFFE60023L),
        AppItem("com.facebook.katana", "Facebook", "Meta Platforms, Inc.", "Social", 4.0f, downloadCount = "5B+", iconBackgroundColor = 0xFF1877F2L),
        AppItem("com.openai.chatgpt", "ChatGPT", "OpenAI", "Productivity", 4.7f, downloadCount = "100M+", iconBackgroundColor = 0xFF10A37FL)
    )

    // Top Grossing Apps (15 apps for Top Charts in Apps Tab)
    val topGrossingAppsChart = listOf(
        AppItem("com.google.android.youtube", "YouTube Premium", "Google LLC", "Video Players", 4.6f, downloadCount = "10B+", iconBackgroundColor = 0xFFFF0000L),
        AppItem("com.tinder", "Tinder: Dating App & Friends", "Tinder LLC", "Lifestyle", 3.8f, downloadCount = "500M+", iconBackgroundColor = 0xFFFF4458L),
        AppItem("com.disney.disneyplus", "Disney+", "Disney", "Entertainment", 4.4f, downloadCount = "500M+", iconBackgroundColor = 0xFF0B1953L),
        AppItem("com.netflix.mediaclient", "Netflix", "Netflix, Inc.", "Entertainment", 4.2f, downloadCount = "1B+", iconBackgroundColor = 0xFFE50914L),
        AppItem("com.google.android.apps.subscriptions.red", "Google One", "Google LLC", "Productivity", 4.5f, downloadCount = "1B+", iconBackgroundColor = 0xFF4285F4L),
        AppItem("com.duolingo", "Duolingo Super", "Duolingo", "Education", 4.7f, downloadCount = "500M+", iconBackgroundColor = 0xFF58CC02L),
        AppItem("com.linkedin.android", "LinkedIn: Jobs & Business", "LinkedIn", "Business", 4.3f, downloadCount = "1B+", iconBackgroundColor = 0xFF0A66C2L),
        AppItem("com.bumble.app", "Bumble Dating App: Match & Date", "Bumble Holding", "Lifestyle", 4.0f, downloadCount = "100M+", iconBackgroundColor = 0xFFFFC629L),
        AppItem("com.canva.editor", "Canva: Design, Photo & Video", "Canva", "Art & Design", 4.8f, downloadCount = "100M+", iconBackgroundColor = 0xFF00C4CCL),
        AppItem("com.picsart.studio", "Picsart AI Photo Editor", "PicsArt, Inc.", "Photography", 4.3f, downloadCount = "500M+", iconBackgroundColor = 0xFFEC1C6AL),
        AppItem("com.crunchyroll.crunchyroid", "Crunchyroll", "Crunchyroll, LLC", "Comics", 4.4f, downloadCount = "100M+", iconBackgroundColor = 0xFFF47521L),
        AppItem("tv.twitch.android.app", "Twitch: Live Game Streaming", "Twitch Interactive", "Entertainment", 4.4f, downloadCount = "100M+", iconBackgroundColor = 0xFF9146FFL),
        AppItem("com.truecaller", "Truecaller Premium", "Truecaller", "Communication", 4.5f, downloadCount = "1B+", iconBackgroundColor = 0xFF0077FAL),
        AppItem("com.microsoft.office.officehubrow", "Microsoft 365 (Office)", "Microsoft Corporation", "Productivity", 4.4f, downloadCount = "500M+", iconBackgroundColor = 0xFFEA3E23L),
        AppItem("com.myfitnesspal.android", "MyFitnessPal: Calorie Counter", "MyFitnessPal, Inc.", "Health & Fitness", 4.4f, downloadCount = "100M+", iconBackgroundColor = 0xFF0066EEL)
    )

    // Trending Apps (15 apps for Top Charts in Apps Tab)
    val trendingAppsChart = listOf(
        AppItem("com.openai.chatgpt", "ChatGPT", "OpenAI", "Productivity", 4.7f, downloadCount = "100M+", iconBackgroundColor = 0xFF10A37FL),
        AppItem("com.google.android.apps.bard", "Google Gemini", "Google LLC", "Productivity", 4.5f, downloadCount = "50M+", iconBackgroundColor = 0xFF4285F4L),
        AppItem("ai.perplexity.app.android", "Perplexity - Ask Anything", "Perplexity AI", "Knowledge", 4.8f, downloadCount = "10M+", iconBackgroundColor = 0xFF1FB8CDL),
        AppItem("com.lemon.lvoverseas", "CapCut - Video Editor", "Bytedance Pte. Ltd.", "Video Players", 4.4f, downloadCount = "500M+", iconBackgroundColor = 0xFF212121L),
        AppItem("com.zhiliaoapp.musically", "TikTok Lite", "TikTok Pte. Ltd.", "Social", 4.3f, downloadCount = "500M+", iconBackgroundColor = 0xFF000000L),
        AppItem("com.threads.android", "Threads, an Instagram app", "Instagram", "Social", 4.1f, downloadCount = "100M+", iconBackgroundColor = 0xFF101010L),
        AppItem("com.whatsapp.w4b", "WhatsApp Business", "WhatsApp LLC", "Communication", 4.4f, downloadCount = "1B+", iconBackgroundColor = 0xFF128C7EL),
        AppItem("com.spotify.music", "Spotify: Music and Podcasts", "Spotify AB", "Music & Audio", 4.4f, downloadCount = "1B+", iconBackgroundColor = 0xFF1DB954L),
        AppItem("org.telegram.messenger", "Telegram", "Telegram FZ-LLC", "Communication", 4.5f, downloadCount = "1B+", iconBackgroundColor = 0xFF2AABEEL),
        AppItem("com.snapchat.android", "Snapchat", "Snap Inc", "Social", 4.1f, downloadCount = "1B+", iconBackgroundColor = 0xFFFFFC00L),
        AppItem("com.duolingo", "Duolingo: Language Lessons", "Duolingo", "Education", 4.7f, downloadCount = "500M+", iconBackgroundColor = 0xFF58CC02L),
        AppItem("com.supercell.squad", "Squad Busters", "Supercell", "Action", 4.3f, downloadCount = "50M+", iconBackgroundColor = 0xFFFFCC00L),
        AppItem("com.reddit.frontpage", "Reddit", "reddit Inc.", "News & Magazines", 4.2f, downloadCount = "100M+", iconBackgroundColor = 0xFFFF4500L),
        AppItem("com.discord", "Discord: Talk, Chat & Hang Out", "Discord Inc.", "Communication", 4.4f, downloadCount = "500M+", iconBackgroundColor = 0xFF5865F2L),
        AppItem("com.notion.android", "Notion - Notes, Docs, Tasks", "Notion Labs, Inc.", "Productivity", 4.6f, downloadCount = "50M+", iconBackgroundColor = 0xFF1A1A1AL)
    )

    // 16 Categories for Apps Tab
    val allAppCategories = listOf(
        CategoryItem("Social", 0xFF4285F4L, Icons.Outlined.People),
        CategoryItem("Communication", 0xFF0F9D58L, Icons.Outlined.Chat),
        CategoryItem("Tools", 0xFFFBBC04L, Icons.Outlined.Build),
        CategoryItem("Photography", 0xFF34A853L, Icons.Outlined.PhotoCamera),
        CategoryItem("Education", 0xFFA142F4L, Icons.Outlined.School),
        CategoryItem("Finance", 0xFF24C1E0L, Icons.Outlined.AccountBalance),
        CategoryItem("Health & Fitness", 0xFFF538A0L, Icons.Outlined.FitnessCenter),
        CategoryItem("Shopping", 0xFFFA903EL, Icons.Outlined.ShoppingCart),
        CategoryItem("Travel", 0xFF00ACC1L, Icons.Outlined.Flight),
        CategoryItem("Food & Drink", 0xFFFF5722L, Icons.Outlined.Restaurant),
        CategoryItem("Music & Audio", 0xFF673AB7L, Icons.Outlined.MusicNote),
        CategoryItem("Video Players", 0xFFE91E63L, Icons.Outlined.PlayCircle),
        CategoryItem("Books & Reference", 0xFF795548L, Icons.Outlined.MenuBook),
        CategoryItem("News", 0xFF607D8BL, Icons.Outlined.Newspaper),
        CategoryItem("Maps", 0xFF3F51B5L, Icons.Outlined.Map),
        CategoryItem("Productivity", 0xFF009688L, Icons.Outlined.CheckCircle)
    )

    // Category Detail 20 apps
    fun getCategoryApps(categoryName: String): List<AppItem> {
        val baseColor = when (categoryName.lowercase()) {
            "social" -> 0xFF4285F4L
            "communication" -> 0xFF0F9D58L
            "tools" -> 0xFFFBBC04L
            "photography" -> 0xFF34A853L
            "education" -> 0xFFA142F4L
            "finance" -> 0xFF24C1E0L
            "shopping" -> 0xFFFA903EL
            else -> 0xFF01875FL
        }
        return (1..20).map { i ->
            AppItem(
                packageName = "com.category.${categoryName.lowercase().replace(" ", "_")}.app$i",
                name = "$categoryName Pro $i",
                developerName = "$categoryName Studio",
                category = categoryName,
                rating = (4.0f + (i % 10) * 0.1f),
                downloadCount = "${(21 - i) * 10}M+",
                fileSizeMb = 20f + (i * 2f),
                iconBackgroundColor = baseColor
            )
        }
    }

    // ==========================================
    // PHASE 5: GAMES TAB DATA
    // ==========================================

    // Featured Game
    val featuredGame = GameItem(
        id = "com.miHoYo.GenshinImpact",
        name = "Genshin Impact",
        rating = 4.6f,
        size = "3.4 GB",
        primaryColor = 0xFF1A237EL,
        secondaryColor = 0xFF4A148CL,
        developer = "Cognosphere PTE. LTD.",
        downloads = "100M+",
        inAppPurchases = true
    )

    // Top Free Games (8 games for Games Tab)
    val topFreeGames = listOf(
        GameItem("com.kiloo.subwaysurf", "Subway Surfers", 4.6f, "95 MB", 0xFF0288D1L, 0xFF00BCD4L, "SYBO Games", 0xFF0288D1L, "1B+"),
        GameItem("com.dts.freefiremax", "Free Fire MAX", 4.2f, "620 MB", 0xFFC2185BL, 0xFF880E4FL, "Garena International", 0xFFC2185BL, "100M+"),
        GameItem("com.pubg.imobile", "BGMI", 4.3f, "750 MB", 0xFFD84315L, 0xFFBF360CL, "KRAFTON, Inc.", 0xFFD84315L, "100M+"),
        GameItem("com.king.candycrushsaga", "Candy Crush Saga", 4.6f, "88 MB", 0xFFFF4081L, 0xFFF50057L, "King", 0xFFFF4081L, "1B+"),
        GameItem("com.roblox.client", "Roblox", 4.4f, "180 MB", 0xFF37474FL, 0xFF212121L, "Roblox Corporation", 0xFF37474FL, "500M+"),
        GameItem("com.innersloth.spacemafia", "Among Us", 4.3f, "145 MB", 0xFFD32F2FL, 0xFFB71C1CL, "Innersloth LLC", 0xFFD32F2FL, "500M+"),
        GameItem("com.fingersoft.hillclimb", "Hill Climb Racing", 4.5f, "82 MB", 0xFF388E3CL, 0xFF1B5E20L, "Fingersoft", 0xFF388E3CL, "500M+"),
        GameItem("com.miniclip.eightballpool", "8 Ball Pool", 4.4f, "98 MB", 0xFF1976D2L, 0xFF0D47A1L, "Miniclip.com", 0xFF1976D2L, "1B+")
    )

    // New & Updated Games (6 games for Games Tab)
    val newUpdatedGames = listOf(
        GameItem("com.supercell.squad", "Squad Busters", 4.4f, "240 MB", 0xFFFFB300L, 0xFFFFA000L, "Supercell", 0xFFFFB300L, "50M+"),
        GameItem("com.gameloft.android.ANMP.GloftA9HM", "Asphalt Legends Unite", 4.5f, "2.2 GB", 0xFF0D47A1L, 0xFF00E5FFL, "Gameloft SE", 0xFF0D47A1L, "100M+"),
        GameItem("com.activision.callofduty.warzone", "COD: Warzone Mobile", 4.1f, "1.8 GB", 0xFF212121L, 0xFF424242L, "Activision", 0xFF212121L, "50M+"),
        GameItem("com.supercell.clashofclans", "Clash of Clans", 4.5f, "290 MB", 0xFFE65100L, 0xFFEF6C00L, "Supercell", 0xFFE65100L, "500M+"),
        GameItem("com.ea.gp.fifamobile", "EA SPORTS FC Mobile", 4.3f, "210 MB", 0xFF1B5E20L, 0xFF2E7D32L, "ELECTRONIC ARTS", 0xFF1B5E20L, "100M+"),
        GameItem("com.supercell.brawlstars", "Brawl Stars", 4.6f, "320 MB", 0xFF6A1B9AL, 0xFF4A148CL, "Supercell", 0xFF6A1B9AL, "100M+")
    )

    // Top Games Numbered List (10 games for Games Tab)
    val topGamesChart = listOf(
        GameItem("com.dts.freefiremax", "Free Fire MAX", 4.2f, "620 MB", 0xFFC2185BL, 0xFF880E4FL, "Garena International", 0xFFC2185BL, "100M+"),
        GameItem("com.pubg.imobile", "BGMI", 4.3f, "750 MB", 0xFFD84315L, 0xFFBF360CL, "KRAFTON, Inc.", 0xFFD84315L, "100M+"),
        GameItem("com.kiloo.subwaysurf", "Subway Surfers", 4.6f, "95 MB", 0xFF0288D1L, 0xFF00BCD4L, "SYBO Games", 0xFF0288D1L, "1B+"),
        GameItem("com.king.candycrushsaga", "Candy Crush Saga", 4.6f, "88 MB", 0xFFFF4081L, 0xFFF50057L, "King", 0xFFFF4081L, "1B+"),
        GameItem("com.supercell.clashofclans", "Clash of Clans", 4.5f, "290 MB", 0xFFE65100L, 0xFFEF6C00L, "Supercell", 0xFFE65100L, "500M+"),
        GameItem("com.roblox.client", "Roblox", 4.4f, "180 MB", 0xFF37474FL, 0xFF212121L, "Roblox Corporation", 0xFF37474FL, "500M+"),
        GameItem("com.gameloft.android.ANMP.GloftA9HM", "Asphalt 9: Legends", 4.5f, "2.1 GB", 0xFF0D47A1L, 0xFF00E5FFL, "Gameloft SE", 0xFF0D47A1L, "100M+"),
        GameItem("com.ea.gp.fifamobile", "EA SPORTS FC Mobile", 4.3f, "210 MB", 0xFF1B5E20L, 0xFF2E7D32L, "ELECTRONIC ARTS", 0xFF1B5E20L, "100M+"),
        GameItem("com.supercell.brawlstars", "Brawl Stars", 4.6f, "320 MB", 0xFF6A1B9AL, 0xFF4A148CL, "Supercell", 0xFF6A1B9AL, "100M+"),
        GameItem("com.miniclip.eightballpool", "8 Ball Pool", 4.4f, "98 MB", 0xFF1976D2L, 0xFF0D47A1L, "Miniclip.com", 0xFF1976D2L, "1B+")
    )

    // Game Categories (10 categories for Games Tab)
    val gameCategories = listOf(
        CategoryItem("Action", 0xFFEA4335L, Icons.Outlined.FlashOn),
        CategoryItem("Puzzle", 0xFF4285F4L, Icons.Outlined.Extension),
        CategoryItem("Racing", 0xFFFA903EL, Icons.Outlined.DirectionsCar),
        CategoryItem("RPG", 0xFFA142F4L, Icons.Outlined.Shield),
        CategoryItem("Strategy", 0xFF34A853L, Icons.Outlined.Psychology),
        CategoryItem("Casual", 0xFFFBBC04L, Icons.Outlined.SentimentSatisfied),
        CategoryItem("Sports", 0xFF24C1E0L, Icons.Outlined.SportsSoccer),
        CategoryItem("Simulation", 0xFFF538A0L, Icons.Outlined.FlightTakeoff),
        CategoryItem("Adventure", 0xFF795548L, Icons.Outlined.Explore),
        CategoryItem("Arcade", 0xFF00BCD4L, Icons.Outlined.VideogameAsset)
    )
}
