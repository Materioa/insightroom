import { getDb } from './db.js';

/**
 * Get the analytics sessions collection
 */
export async function getAnalyticsCollection() {
    const db = await getDb();
    return db.collection('post_analytics_sessions');
}

/**
 * Aggregates analytics for a single post.
 * @param {string} postId - The ID of the post.
 * @param {number} [days=14] - The timeframe for timeline charts.
 * @returns {Promise<any>}
 */
export async function getPostAnalytics(postId, days = 14) {
    const collection = await getAnalyticsCollection();
    const filter = { postId };

    // Calculate dates for timeline filter
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 1. Basic Stats Aggregation
    const statsResult = await collection.aggregate([
        { $match: filter },
        {
            $group: {
                _id: null,
                totalViews: { $sum: 1 },
                totalDuration: { $sum: '$duration' },
                avgScrollDepth: { $avg: '$scrollDepth' },
                retainedViews: {
                    $sum: {
                        $cond: [{ $gte: ['$duration', 30] }, 1, 0]
                    }
                }
            }
        }
    ]).toArray();

    const stats = statsResult[0] || {
        totalViews: 0,
        totalDuration: 0,
        avgScrollDepth: 0,
        retainedViews: 0
    };

    // Get the base claps from the actual post document
    const db = await getDb();
    let postDoc = null;
    try {
        const { ObjectId } = await import('mongodb');
        postDoc = await db.collection('posts').findOne({ _id: new ObjectId(postId) }, { projection: { claps: 1 } });
    } catch (e) {
        // Fallback if postId is not an ObjectId
        postDoc = await db.collection('posts').findOne({ slug: postId }, { projection: { claps: 1 } });
    }
    stats.totalClaps = postDoc && postDoc.claps ? postDoc.claps : 0;

    // Calculate retention rate
    stats.retentionRate = stats.totalViews > 0 
        ? Math.round((stats.retainedViews / stats.totalViews) * 100) 
        : 0;

    // 2. Timeline Aggregation (Views per day)
    const timelineResult = await collection.aggregate([
        { 
            $match: { 
                postId,
                createdAt: { $gte: startDate } 
            } 
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                views: { $sum: 1 },
                duration: { $sum: '$duration' }
            }
        },
        { $sort: { _id: 1 } }
    ]).toArray();

    // Populate timeline with 0 values for empty days to ensure complete graphs
    const timelineMap = new Map(timelineResult.map(item => [item._id, item]));
    const timeline = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const existing = timelineMap.get(dateStr);
        timeline.push({
            date: dateStr,
            views: existing ? existing.views : 0,
            duration: existing ? existing.duration : 0
        });
    }

    // 3. Geographic Aggregation
    const locations = await collection.aggregate([
        { $match: filter },
        {
            $group: {
                _id: { country: '$country', city: '$city' },
                views: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                country: '$_id.country',
                city: '$_id.city',
                views: 1
            }
        },
        { $sort: { views: -1 } },
        { $limit: 15 }
    ]).toArray();

    // 4. Clicks aggregation
    const clicks = await collection.aggregate([
        { $match: filter },
        { $unwind: '$clicks' },
        {
            $group: {
                _id: { id: '$clicks.id', text: '$clicks.text' },
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                elementId: '$_id.id',
                label: '$_id.text',
                count: 1
            }
        },
        { $sort: { count: -1 } },
        { $limit: 15 }
    ]).toArray();

    // 5. Settings changes aggregation
    const settingsChanges = await collection.aggregate([
        { $match: filter },
        { $unwind: '$settingsChanges' },
        {
            $group: {
                _id: { type: '$settingsChanges.type', value: '$settingsChanges.value' },
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                type: '$_id.type',
                value: '$_id.value',
                count: 1
            }
        },
        { $sort: { count: -1 } }
    ]).toArray();

    // 6. Last left off at points
    const leftOffPoints = await collection.aggregate([
        { 
            $match: { 
                postId, 
                lastLeftOff: { $exists: true, $ne: '' } 
            } 
        },
        {
            $group: {
                _id: '$lastLeftOff',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
            $project: {
                _id: 0,
                section: '$_id',
                count: 1
            }
        }
    ]).toArray();

    return {
        stats,
        timeline,
        locations,
        clicks,
        settingsChanges,
        leftOffPoints
    };
}

/**
 * Aggregates general/collective analytics for all posts.
 * @param {number} [days=30] - The timeframe for dashboard timeline.
 * @returns {Promise<any>}
 */
export async function getGeneralAnalytics(days = 30) {
    const collection = await getAnalyticsCollection();

    // Calculate dates for timeline filter
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 1. Overall aggregated statistics
    const statsResult = await collection.aggregate([
        {
            $group: {
                _id: null,
                totalViews: { $sum: 1 },
                totalDuration: { $sum: '$duration' },
                avgScrollDepth: { $avg: '$scrollDepth' },
                retainedViews: {
                    $sum: {
                        $cond: [{ $gte: ['$duration', 30] }, 1, 0]
                    }
                }
            }
        }
    ]).toArray();

    const stats = statsResult[0] || {
        totalViews: 0,
        totalDuration: 0,
        avgScrollDepth: 0,
        retainedViews: 0
    };

    const db = await getDb();
    const allClapsAgg = await db.collection('posts').aggregate([
        { $group: { _id: null, totalClaps: { $sum: '$claps' } } }
    ]).toArray();
    stats.totalClaps = allClapsAgg[0] ? allClapsAgg[0].totalClaps : 0;

    stats.retentionRate = stats.totalViews > 0 
        ? Math.round((stats.retainedViews / stats.totalViews) * 100) 
        : 0;

    // 2. Timeline Aggregation (Site-wide views per day)
    const timelineResult = await collection.aggregate([
        { 
            $match: { 
                createdAt: { $gte: startDate } 
            } 
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                views: { $sum: 1 },
                duration: { $sum: '$duration' }
            }
        },
        { $sort: { _id: 1 } }
    ]).toArray();

    const timelineMap = new Map(timelineResult.map(item => [item._id, item]));
    const timeline = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const existing = timelineMap.get(dateStr);
        timeline.push({
            date: dateStr,
            views: existing ? existing.views : 0,
            duration: existing ? existing.duration : 0
        });
    }

    // 3. Top Posts by Views / Engagement
    const topPosts = await collection.aggregate([
        {
            $group: {
                _id: '$postId',
                title: { $first: '$title' },
                slug: { $first: '$slug' },
                views: { $sum: 1 },
                totalDuration: { $sum: '$duration' },
                totalClaps: { $sum: '$claps' },
                avgScrollDepth: { $avg: '$scrollDepth' },
                retainedViews: {
                    $sum: {
                        $cond: [{ $gte: ['$duration', 30] }, 1, 0]
                    }
                }
            }
        },
        {
            $project: {
                id: '$_id',
                title: 1,
                slug: 1,
                views: 1,
                totalDuration: 1,
                totalClaps: 1,
                avgScrollDepth: { $round: ['$avgScrollDepth', 1] },
                retentionRate: {
                    $cond: [
                        { $gt: ['$views', 0] },
                        { $round: [{ $multiply: [{ $divide: ['$retainedViews', '$views'] }, 100] }, 0] },
                        0
                    ]
                }
            }
        },
        { $sort: { views: -1 } }
    ]).toArray();

    // 4. Geographic distribution (Cities/Regions)
    const topLocations = await collection.aggregate([
        {
            $group: {
                _id: {
                    city: '$city',
                    region: '$region',
                    country: '$country'
                },
                views: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                location: {
                    $cond: [
                        { $and: [ { $ne: ['$_id.city', 'Unknown'] }, { $ne: ['$_id.city', null] }, { $ne: ['$_id.city', ''] } ] },
                        { $concat: ['$_id.city', ', ', { $ifNull: ['$_id.country', 'Unknown'] }] },
                        {
                            $cond: [
                                { $and: [ { $ne: ['$_id.region', 'Unknown'] }, { $ne: ['$_id.region', null] }, { $ne: ['$_id.region', ''] } ] },
                                { $concat: ['$_id.region', ', ', { $ifNull: ['$_id.country', 'Unknown'] }] },
                                { $ifNull: ['$_id.country', 'Unknown'] }
                            ]
                        }
                    ]
                },
                views: 1
            }
        },
        { $sort: { views: -1 } },
        { $limit: 10 }
    ]).toArray();

    return {
        stats,
        timeline,
        topPosts,
        topLocations
    };
}
