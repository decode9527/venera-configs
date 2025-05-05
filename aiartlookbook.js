class AiArtLookbookSource extends ComicSource {
    name = "AI Art Lookbook"
    key = "aiartlookbook"
    version = "1.0.2"
    minAppVersion = "1.2.1"
    url = "https://cdn.jsdelivr.net/gh/yourname/repo@main/sources/aiartlookbook.js"

    static baseUrl = "https://aiartlookbook.com"
    headers = {}

    init() {
        this.headers = {
            "User-Agent": "Mozilla/5.0",
            "Referer": AiArtLookbookSource.baseUrl
        }
    }

    // 自动抓取分类（排除 Videos）
    static categoryMap = {}
    static async fetchCategories() {
        const res = await Network.get(AiArtLookbookSource.baseUrl, {})
        if (res.status !== 200) return

        const doc = new DOMParser().parseFromString(res.body, "text/html")
        const categories = []

        for (let item of doc.querySelectorAll("#menu-top li.menu-item a")) {
            const name = item.innerText.trim()
            const href = item.href

            if (name.toLowerCase().includes("video") || href.includes("/category/videos")) continue

            const slugMatch = href.match(/\/category\/([^\/]+)/)
            if (!slugMatch) continue

            const slug = slugMatch[1]
            AiArtLookbookSource.categoryMap[name] = slug
            categories.push(name)
        }

        this.category.parts[0].categories = categories
        this.category.parts[0].categoryParams = Object.values(AiArtLookbookSource.categoryMap)
    }

    // 分类页面配置
    category = {
        title: "AI 图集分类",
        parts: [
            {
                name: "主题",
                type: "fixed",
                categories: [],
                categoryParams: [],
                itemType: "category"
            }
        ]
    }

    // 加载分类下的漫画/图集列表
    categoryComics = {
        load: async (category, param, options, page) => {
            const url = `${AiArtLookbookSource.baseUrl}/category/${param}/page/${page}`
            const res = await Network.get(url, this.headers)
            if (res.status !== 200) throw `加载分类失败`

            const doc = new DOMParser().parseFromString(res.body, "text/html")

            const items = []
            for (let article of doc.querySelectorAll("article.post.excerpt")) {
                const titleEl = article.querySelector(".title a")
                const coverEl = article.querySelector(".featured-thumbnail img")
                const link = titleEl?.href || ""
                const title = titleEl?.innerText.trim() || "Untitled"
                const cover = coverEl?.src || ""

                items.push({
                    id: link,
                    title: title,
                    cover: cover,
                    subTitle: "",
                    tags: []
                })
            }

            const nextPage = doc.querySelector(".next.page-numbers")
            const maxPage = nextPage ? parseInt(nextPage.href.split("/").filter(p => p.match(/^\d+$/)).pop()) : 1

            return { comics: items, maxPage }
        }
    }

    // 首页推荐图集（直接使用分类第一页）
    explore = [
        {
            title: "最新图集",
            type: "simpleList",
            load: async (page) => {
                const url = `${AiArtLookbookSource.baseUrl}/page/${page || 1}`
                const res = await Network.get(url, this.headers)
                if (res.status !== 200) throw `网络错误`

                const doc = new DOMParser().parseFromString(res.body, "text/html")

                const items = []
                for (let article of doc.querySelectorAll("article.post.excerpt")) {
                    const titleEl = article.querySelector(".title a")
                    const coverEl = article.querySelector(".featured-thumbnail img")
                    const link = titleEl?.href || ""
                    const title = titleEl?.innerText.trim() || "Untitled"
                    const cover = coverEl?.src || ""

                    items.push({
                        id: link,
                        title: title,
                        cover: cover,
                        subTitle: "",
                        tags: []
                    })
                }

                const nextPage = doc.querySelector(".next.page-numbers")
                const maxPage = nextPage ? parseInt(nextPage.href.split("/").filter(p => p.match(/^\d+$/)).pop()) : 1

                return { comics: items, maxPage }
            }
        }
    ]

    // 搜索功能
    search = {
        load: async (keyword, options, page) => {
            const url = `${AiArtLookbookSource.baseUrl}/page/${page}/?s=${encodeURIComponent(keyword)}`
            const res = await Network.get(url, this.headers)
            if (res.status !== 200) throw `搜索失败`

            const doc = new DOMParser().parseFromString(res.body, "text/html")

            const items = []
            for (let article of doc.querySelectorAll("article.post.excerpt")) {
                const titleEl = article.querySelector(".title a")
                const coverEl = article.querySelector(".featured-thumbnail img")
                const link = titleEl?.href || ""
                const title = titleEl?.innerText.trim() || "Untitled"
                const cover = coverEl?.src || ""

                items.push({
                    id: link,
                    title: title,
                    cover: cover,
                    subTitle: "",
                    tags: []
                })
            }

            const nextPage = doc.querySelector(".next.page-numbers")
            const maxPage = nextPage ? parseInt(nextPage.href.split("/").filter(p => p.match(/^\d+$/)).pop()) : 1

            return { comics: items, maxPage }
        },
        optionList: [
            {
                label: "搜索范围",
                type: "select",
                options: ["标题", "全部"]
            }
        ]
    }

    // 漫画详情页 → 展示图集
    comic = {
        loadInfo: async (id) => {
            const res = await Network.get(id, this.headers)
            if (res.status !== 200) throw `加载图集失败`

            const doc = new DOMParser().parseFromString(res.body, "text/html")

            const title = doc.querySelector("h1.entry-title")?.innerText.trim() || "Untitled"
            const description = doc.querySelector(".post-content")?.innerText.trim() || ""

            const images = []
            for (let img of doc.querySelectorAll("figure.wp-block-image.size-large img")) {
                let src = img.srcset
                    ?.split(",")
                    ?.map(s => s.trim())
                    ?.filter(Boolean)
                    ?.find(s => s.includes("1024w"))
                    ?.split(" ")
                    ?.shift()

                if (!src && img.src) {
                    src = img.src
                }

                if (src) {
                    images.push(src)
                }
            }

            return {
                title: title,
                cover: images[0] || "",
                description: description,
                chapters: new Map([["default", "Default"]]),
                isFavorite: false
            }
        },
        loadEp: async (comicId, epId) => {
            try {
                const result = await this.comic.loadInfo(comicId)
                return {
                    images: result.images
                }
            } catch (e) {
                console.error("加载章节失败:", e)
                return {
                    images: []
                }
            }
        }
    }
}

// 初始化时自动抓取分类
AiArtLookbookSource.fetchCategories()