const express = require("express");
const { dbAsync, createHandler } = require("./base_route.js");

// =============================================================================
// 1. GENERIC QUERY BUILDING HELPERS
// =============================================================================

/**
 * A centralized map of all available filters and their corresponding database columns.
 * This makes adding or changing filters a single-line change.
 */
const FILTER_CONFIG = {
    // Standard Filters
    user_Id: { column: 'user_id', type: 'string' },
    division: { column: 'division_name', type: 'string' },
    district: { column: 'district_name', type: 'string' },
    tehsil: { column: 'tehsil_name', type: 'string' },
    gender: { column: 'gender', type: 'string' },
    craft: { column: 'craft_name', type: 'string' },
    category: { column: 'category_name', type: 'string' },
    skill: { column: 'skill_name', type: 'string' },
    education: { column: 'education_name', type: 'string' },
    raw_material: { column: 'raw_material', type: 'string' },
    employment_type: { column: 'employment_type', type: 'string' },
    crafting_method: { column: 'crafting_method', type: 'string' },
    // Boolean-like Filters
    inherited_skills: { column: 'inherited_skills', type: 'string' },
    has_machinery: { column: 'has_machinery', type: 'string' },
    has_training: { column: 'has_training', type: 'string' },
    loan_status: { column: 'loan_status', type: 'string' },
    financial_assistance: { column: 'financial_assistance', type: 'string' },
    technical_assistance: { column: 'technical_assistance', type: 'string' },
    // Numerical Filters
    avg_monthly_income: { column: 'avg_monthly_income', type: 'numerical' },
    dependents_count: { column: 'dependents_count', type: 'numerical' },
};


/**
 * Applies all filters from a request to a base SQL query.
 * This function replaces the need for dozens of repeated 'addFilterCondition' calls.
 * @param {string} baseQuery - The initial SQL query string.
 * @param {object} filters - The filters object from req.query.
 * @returns {{ query: string, params: any[] }} - The final query string and parameters array.
 */
const applyFiltersToQuery = (baseQuery, filters = {}) => {
    let query = baseQuery;
    const params = [];

    for (const key in filters) {
        if (filters[key] && FILTER_CONFIG[key]) {
            const config = FILTER_CONFIG[key];
            const filterValue = filters[key];

            if (config.type === 'string' && filterValue) {
                const values = String(filterValue).split(',').map(v => v.trim()).filter(Boolean);
                if (values.length > 0) {
                    const placeholders = values.map(() => "?").join(", ");
                    query += ` AND a.${config.column} IN (${placeholders})`;
                    params.push(...values);
                }
            } else if (config.type === 'numerical' && filterValue && typeof filterValue === 'string') {
                const value = filterValue.trim();
                if (value.includes('-')) {
                    const [min, max] = value.split('-').map(s => parseFloat(s.trim()));
                    if (!isNaN(min) && !isNaN(max)) {
                        query += ` AND a.${config.column} BETWEEN ? AND ?`;
                        params.push(min, max);
                    }
                } else if (value.startsWith('>')) {
                    const num = parseFloat(value.substring(1));
                    if (!isNaN(num)) {
                        query += ` AND a.${config.column} > ?`;
                        params.push(num);
                    }
                } // Add other numerical conditions as needed (<, =, etc.)
            }
        }
    }
    return { query, params };
};

// =============================================================================
// 2. REUSABLE DATA FORMATTERS
// =============================================================================

/**
 * Formats results for simple 'name'/'value' charts.
 */
const formatSimpleDistribution = (results) => {
    return results.map((item) => ({
        name: item.name ? String(item.name).charAt(0).toUpperCase() + String(item.name).slice(1).toLowerCase() : 'Unknown',
        value: item.value || 0,
    }));
};

/**
 * Formats results for stacked bar charts (e.g., gender by tehsil).
 * @param {string} primaryKey - The main category for the bar (e.g., 'name').
 * @param {string} stackKey - The key to stack by (e.g., 'gender').
 */
const createStackedFormatter = (primaryKey = 'name', stackKey = 'stack_value') => (rows) => {
    const dataMap = new Map();
    const allStackKeys = [...new Set(rows.map(r => r[stackKey]))].filter(Boolean);

    rows.forEach(row => {
        const key = row[primaryKey];
        if (!key) return;

        if (!dataMap.has(key)) {
            const newEntry = { [primaryKey]: key };
            allStackKeys.forEach(type => newEntry[type] = 0);
            dataMap.set(key, newEntry);
        }
        if (row[stackKey]) {
            dataMap.get(key)[row[stackKey]] = row.value || 0;
        }
    });
    return Array.from(dataMap.values());
};

// =============================================================================
// 3. CENTRALIZED CHART OPERATIONS (`chartOps`)
// =============================================================================

const chartOps = {
    /**
     * A single, generic function to fetch data for almost any distribution chart.
     * @param {object} config - Configuration for the chart query.
     * @param {object} filters - The filters from the request.
     */
    async fetchChartData(config, filters) {
        // Build the base query from config parts
        let baseQuery = `${config.select} ${config.from} WHERE a.isActive = 1`;

        // Apply all filters automatically
        const { query: filteredQuery, params } = applyFiltersToQuery(baseQuery, filters);

        // Add Group By, Order By, and Limit
        const finalQuery = [
            filteredQuery,
            config.groupBy ? `GROUP BY ${config.groupBy}` : '',
            config.orderBy ? `ORDER BY ${config.orderBy}` : '',
            config.limit ? `LIMIT ${config.limit}` : ''
        ].join(' ');

        console.log(`Executing Query for: ${config.id}`, finalQuery);
        console.log("Params:", params);

        const results = await dbAsync.all(finalQuery, params);

        // Apply a formatter function to shape the data for the frontend
        return config.formatter(results);
    },

    /**
     * A special case for the dashboard cards, as it uses multiple subqueries.
     * This is also cleaned up to be more efficient and readable.
     */
    async getDashboardData(filters) {
        let whereClause = "AND a.isActive = 1";
        const { query: whereConditions, params } = applyFiltersToQuery('', filters);
        whereClause += ` ${whereConditions.replace(/AND/g, '').trim().replace(/^/, 'AND ')}`;

        const query = `
            SELECT
                (SELECT COUNT(*) FROM artisansView a WHERE 1=1 ${whereClause}) AS total_active_artisans,
                (SELECT COUNT(DISTINCT a.tehsil_id) FROM artisansView a WHERE 1=1 ${whereClause}) AS regions_covered,
                (SELECT COUNT(*) FROM artisansView a WHERE 1=1 ${whereClause} AND a.created_at >= date('now', 'start of month')) AS new_registrations_this_month
        `;

        // Parameters are repeated for each subquery in this structure
        const repeatedParams = [...params, ...params, ...params];

        const result = await dbAsync.get(query, repeatedParams);
        return {
            total_active_artisans: result.total_active_artisans || 0,
            regions_covered: result.regions_covered || 0,
            new_registrations_this_month: result.new_registrations_this_month || 0,
        };
    }
};

// =============================================================================
// 4. CHART CONFIGURATION
// Maps routes/chart names to their specific query configurations.
// This is now the "single source of truth" for defining charts.
// =============================================================================

const CHART_DEFINITIONS = {
    // Simple Distributions (Pie/Bar Charts)
    'gender': {
        id: 'Gender Distribution',
        select: "SELECT a.gender as name, COUNT(*) as value",
        from: "FROM artisansView a",
        groupBy: "name",
        formatter: formatSimpleDistribution
    },
    'education': {
        id: 'Education Distribution',
        select: "SELECT a.education_name as name, COUNT(*) as value",
        from: "FROM artisansView a",
        groupBy: "name",
        formatter: formatSimpleDistribution
    },
    'employment-type': {
        id: 'Employment Type Distribution',
        select: "SELECT a.employment_type as name, COUNT(*) as value",
        from: "FROM artisansView a",
        groupBy: "name",
        formatter: formatSimpleDistribution
    },
    'division': {
        id: 'Division Distribution',
        select: "SELECT a.division_name as name, COUNT(*) as value",
        from: "FROM artisansView a",
        groupBy: "name",
        formatter: formatSimpleDistribution
    },
    'district': {
        id: 'District Distribution',
        select: "SELECT a.district_name as name, COUNT(*) as value",
        from: "FROM artisansView a",
        groupBy: "name",
        formatter: formatSimpleDistribution
    },
    'tehsil': {
        id: 'Tehsil Distribution',
        select: "SELECT a.tehsil_name as name, COUNT(*) as value",
        from: "FROM artisansView a",
        groupBy: "name",
        formatter: formatSimpleDistribution
    },
    // Dynamic Distributions (groupBy specified in URL)
    'distribution': {
        id: 'Dynamic Distribution',
        dynamicGroupBy: {
            'skill': 'a.skill_name',
            'craft': 'a.craft_name',
            'category': 'a.category_name'
        },
        select: (groupByColumn) => `SELECT ${groupByColumn} as name, COUNT(*) as value`,
        from: "FROM artisansView a",
        formatter: formatSimpleDistribution
    },
    'top-distribution': {
        id: 'Top 5 Dynamic Distribution',
        dynamicGroupBy: {
            'skill': 'a.skill_name',
            'craft': 'a.craft_name',
            'category': 'a.category_name'
        },
        select: (groupByColumn) => `SELECT ${groupByColumn} as name, COUNT(*) as value`,
        from: "FROM artisansView a",
        orderBy: "value DESC",
        limit: 5,
        formatter: formatSimpleDistribution
    },
    // More complex charts
    'average-income-by': {
        id: 'Average Income By Group',
        dynamicGroupBy: {
            'skill': 'a.skill_name',
            'craft': 'a.craft_name',
            'category': 'a.category_name'
        },
        select: (groupByColumn) => `SELECT ${groupByColumn} as name, ROUND(AVG(a.avg_monthly_income), 2) as value`,
        from: "FROM artisansView a",
        orderBy: "value DESC",
        formatter: (results) => results.map(r => ({ name: r.name, avgIncome: r.value }))
    },
    // Stacked chart example
    'distribution-by-employment': {
        id: 'Dynamic Distribution by Employment',
        dynamicGroupBy: {
            'skill': 'a.skill_name',
            'craft': 'a.craft_name',
            'category': 'a.category_name'
        },
        select: (groupByColumn) => `SELECT ${groupByColumn} as name, a.employment_type as stack_value, COUNT(*) as value`,
        from: "FROM artisansView a",
        formatter: createStackedFormatter('name', 'stack_value')
    },
    // Binned/Categorized charts
    'age': {
        id: 'Age Distribution',
        select: `SELECT CASE 
            WHEN (strftime('%Y', 'now') - strftime('%Y', a.date_of_birth)) < 18 THEN 'Under 18'
            WHEN (strftime('%Y', 'now') - strftime('%Y', a.date_of_birth)) BETWEEN 18 AND 24 THEN '18-24'
            WHEN (strftime('%Y', 'now') - strftime('%Y', a.date_of_birth)) BETWEEN 25 AND 35 THEN '25-35'
            WHEN (strftime('%Y', 'now') - strftime('%Y', a.date_of_birth)) BETWEEN 36 AND 50 THEN '36-50'
            ELSE '51+' END as name, COUNT(*) as value`,
        from: "FROM artisansView a",
        groupBy: "name",
        formatter: formatSimpleDistribution
    },
    // And so on for other charts like experience, income, etc.
};


// =============================================================================
// 5. GENERIC ROUTE HANDLERS
// =============================================================================

module.exports = (dependencies) => {
    const { logger } = dependencies;
    const router = express.Router();

    /**
     * A generic handler for any chart defined in CHART_DEFINITIONS.
     */
    const universalChartHandler = createHandler(async (req, res) => {
        // e.g., 'gender' from '/charts/gender' or 'distribution' from '/charts/distribution/skill'
        const chartName = req.params.chartName;
        const config = CHART_DEFINITIONS[chartName];

        if (!config) {
            return res.status(404).json({ error: `Chart '${chartName}' not found.` });
        }

        const routeLogger = logger.child({ route: "charts", handler: config.id, filters: req.query });
        routeLogger.info("Fetching chart data");

        try {
            let finalConfig = { ...config };
            // Handle dynamic grouping based on a URL parameter (e.g., /:groupBy)
            if (config.dynamicGroupBy) {
                const groupByValue = req.params.groupBy; // e.g., 'skill'
                const groupByColumn = config.dynamicGroupBy[groupByValue];
                if (!groupByColumn) {
                    return res.status(400).json({ error: `Invalid groupBy parameter '${groupByValue}'` });
                }
                // Dynamically create the SELECT and GROUP BY clauses
                finalConfig.select = config.select(groupByColumn);
                finalConfig.groupBy = 'name'; // We always alias the dynamic column to 'name'
            }

            const data = await chartOps.fetchChartData(finalConfig, req.query);
            res.json(data);
        } catch (error) {
            routeLogger.error({ error }, "Error fetching chart data");
            res.status(500).json({ error: error.message });
        }
    });

    // =============================================================================
    // 6. ROUTE DEFINITIONS
    // =============================================================================

    // Special handler for dashboard data
    router.get('/dashboard', createHandler(async (req, res) => {
        // ... implementation for dashboard handler using chartOps.getDashboardData
        const data = await chartOps.getDashboardData(req.query);
        res.json(data);
    }));

    // A single route for all simple distribution charts
    router.get('/:chartName', universalChartHandler);

    // A single route for all dynamic distribution charts
    router.get('/:chartName/:groupBy', universalChartHandler);

    return router;
};
