const express = require("express");
const db = require("../db");
const router = express.Router();
const { dbAsync, createHandler } = require("./base_route.js");

/**
 * Chart-specific database operations
 */
// Helper function to add condition for potentially comma-separated values (for string/categorical filters)
const addFilterCondition = (filterValue, columnName, paramsArray, queryString) => {
  if (filterValue) {
    // Split comma-separated string, trim whitespace, and remove empty strings
    const values = typeof filterValue === 'string' ? filterValue.split(',').map(v => v.trim()).filter(v => v !== '') : [filterValue];

    if (values.length > 0) {
      // Use lowercase column names for safety unless case-sensitivity is required by DB
      const lowerColumnName = columnName.toLowerCase();
      if (values.length > 1) {
        // Multi-select: Use IN clause
        const placeholders = values.map(() => "?").join(", ");
        queryString += ` AND ${lowerColumnName} IN (${placeholders})`;
        paramsArray.push(...values);
      } else {
        // Single select or single value from split
        queryString += ` AND ${lowerColumnName} = ?`;
        paramsArray.push(values[0]);
      }
    }
  }
  return queryString;
};

// Helper function for numerical range filtering
const addNumericalRangeCondition = (filterValue, columnName, paramsArray, queryString) => {
  if (filterValue && typeof filterValue === 'string' && filterValue !== 'Select') {
    const lowerColumnName = columnName.toLowerCase();
    const value = filterValue.trim();

    if (value.includes('-')) {
      // Handle range like "10000-20000"
      const [minStr, maxStr] = value.split('-').map(s => s.trim());
      const min = parseFloat(minStr);
      const max = parseFloat(maxStr);

      if (!isNaN(min) && !isNaN(max)) {
        queryString += ` AND ${lowerColumnName} BETWEEN ? AND ?`;
        paramsArray.push(min, max);
      } else if (!isNaN(min)) { // Handle cases like "10000-" (greater than or equal)
        queryString += ` AND ${lowerColumnName} >= ?`;
        paramsArray.push(min);
      } else if (!isNaN(max)) { // Handle cases like "-20000" (less than or equal)
        queryString += ` AND ${lowerColumnName} <= ?`;
        paramsArray.push(max);
      }


    } else if (value.startsWith('>')) {
      // Handle "greater than" like ">50000"
      const num = parseFloat(value.substring(1).trim());
      if (!isNaN(num)) {
        queryString += ` AND ${lowerColumnName} > ?`;
        paramsArray.push(num);
      }
    } else if (value.startsWith('<')) {
      // Handle "less than" like "<10000"
      const num = parseFloat(value.substring(1).trim());
      if (!isNaN(num)) {
        queryString += ` AND ${lowerColumnName} < ?`;
        paramsArray.push(num);
      }
    }
    else {
      // Handle exact numerical value
      const num = parseFloat(value);
      if (!isNaN(num)) {
        queryString += ` AND ${lowerColumnName} = ?`;
        paramsArray.push(num);
      }
    }
  }
  return queryString;
};


const chartOps = {
  // Gender distribution
  // Now accepts a filters object
  getGenderDistribution(filters = {}) {
    // Extract all potential filters that could apply
    const {
      division,
      district,
      tehsil,
      gender, // Note: Filtering *by* gender here is correct as it restricts the population before grouping
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
      // Add any other filters you might apply to this dataset
    } = filters;

    // Start with the base query including the initial WHERE clause
    // Use the view `artisansView` if that's where all these columns are consolidated
    let query = "SELECT gender, COUNT(*) as value FROM artisansView a WHERE a.isActive = 1";
    const params = []; // Initialize parameters array

    // Apply filters using the helper functions
    // Use the exact column names from your artisansView
    query = addFilterCondition(division, 'division_name', params, query); // Verify column name
    query = addFilterCondition(district, 'district_name', params, query); // Verify column name
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);     // Verify column name
    query = addFilterCondition(gender, 'gender', params, query);           // Applies the gender filter to the dataset
    query = addFilterCondition(craft, 'craft_name', params, query);       // Verify column name
    query = addFilterCondition(category, 'category_name', params, query); // Verify column name
    query = addFilterCondition(skill, 'skill_name', params, query);       // Verify column name
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query); // Verify column name
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query); // Assuming DB stores strings like 'Yes'/'No' or similar
    query = addFilterCondition(has_training, 'has_training', params, query);   // Assuming DB stores strings
    query = addFilterCondition(loan_status, 'loan_status', params, query);       // Assuming DB stores strings
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query); // Assuming DB stores strings
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query); // Assuming DB stores strings

    // Apply numerical filters
    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query); // Verify column name
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);   // Verify column name


    // Add the GROUP BY clause after all WHERE conditions
    query += " GROUP BY gender";

    // Optional: Add ORDER BY if you want consistent sorting
    // query += " ORDER BY gender ASC";


    console.log("Gender Distribution Query:", query); // Log the constructed query for debugging
    console.log("Gender Distribution Params:", params); // Log parameters

    return dbAsync
      .all(query, params) // Pass parameters to dbAsync.all
      .then((results) => {
        // Map results to the format expected by the frontend, handling potential nulls
        return results.map((item) => ({
          name: item.gender ? String(item.gender).charAt(0).toUpperCase() + String(item.gender).slice(1).toLowerCase() : 'Unknown', // Ensure gender is string, handle null, format name
          value: item.value || 0, // Ensure value is a number, handle null
        }));
      });
  },

  getDashboardData(filters = {}) {
    // Extract all potential filters
    const {
      user_Id,
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    // Initialize query and parameters
    let query = `
      SELECT
        (SELECT COUNT(*) FROM artisansView a WHERE a.isActive = 1 {WHERE_CLAUSE}) AS total_active_artisans,
        (SELECT COUNT(DISTINCT a.tehsil_id) FROM artisansView a WHERE a.isActive = 1 {WHERE_CLAUSE}) AS regions_covered,
        (SELECT COUNT(*) FROM artisansView a WHERE a.isActive = 1 {WHERE_CLAUSE} AND a.created_at >= date('now', '-1 month')) AS new_registrations_this_month,
        (SELECT COUNT(*) FROM artisansView a WHERE a.isActive = 1 {WHERE_CLAUSE} AND a.created_at >= date('now', '-2 month') AND a.created_at < date('now', '-1 month')) AS new_registrations_last_month
    `;
    const params = [];

    // Initialize WHERE clause
    let whereClause = "";

    // Apply filters using helper functions
    whereClause = addFilterCondition(user_Id, 'user_id', params, whereClause); // Use user_id (lowercase) to match DB convention
    whereClause = addFilterCondition(division, 'division_name', params, whereClause);
    whereClause = addFilterCondition(district, 'district_name', params, whereClause);
    whereClause = addFilterCondition(tehsil, 'tehsil_name', params, whereClause);
    whereClause = addFilterCondition(gender, 'gender', params, whereClause);
    whereClause = addFilterCondition(craft, 'craft_name', params, whereClause);
    whereClause = addFilterCondition(category, 'category_name', params, whereClause);
    whereClause = addFilterCondition(skill, 'skill_name', params, whereClause);
    whereClause = addFilterCondition(education, 'education', params, whereClause);
    whereClause = addFilterCondition(raw_material, 'raw_material', params, whereClause);
    whereClause = addFilterCondition(employment_type, 'employment_type', params, whereClause);
    whereClause = addFilterCondition(crafting_method, 'crafting_method', params, whereClause);
    whereClause = addFilterCondition(inherited_skills, 'inherited_skills', params, whereClause);
    whereClause = addFilterCondition(has_machinery, 'has_machinery', params, whereClause);
    whereClause = addFilterCondition(has_training, 'has_training', params, whereClause);
    whereClause = addFilterCondition(loan_status, 'loan_status', params, whereClause);
    whereClause = addFilterCondition(financial_assistance, 'financial_assistance', params, whereClause);
    whereClause = addFilterCondition(technical_assistance, 'technical_assistance', params, whereClause);

    // Apply numerical filters
    whereClause = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, whereClause);
    whereClause = addNumericalRangeCondition(dependents_count, 'dependents_count', params, whereClause);

    // Replace placeholder with actual WHERE clause
    query = query.replace(/{WHERE_CLAUSE}/g, whereClause);

    // Repeat parameters for each subquery (4 subqueries)
    const repeatedParams = [];
    for (let i = 0; i < 4; i++) {
      repeatedParams.push(...params);
    }

    console.log("Dashboard Data Query:", query); // Log the constructed query for debugging
    console.log("Dashboard Data Params:", repeatedParams); // Log parameters

    return dbAsync
      .all(query, repeatedParams)
      .then((results) => {
        // Ensure the result is formatted as expected by the frontend
        const result = results[0] || {};
        console.log("Dashboard results:", results); // Log results

        return {
          total_active_artisans: result.total_active_artisans || 0,
          regions_covered: result.regions_covered || 0,
          new_registrations_this_month: result.new_registrations_this_month || 0,
          new_registrations_last_month: result.new_registrations_last_month || 0,
        };
      });
  },
  // Education level distribution
  getEducationDistribution(filters = {}) {
    // Extract all potential filters
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    // Start with the base query including the initial WHERE clause
    let query = `
      SELECT el.name, COUNT(*) as value 
      FROM artisansView a 
      JOIN education el ON a.education_level_id = el.id 
      WHERE a.isActive = 1
    `;
    const params = []; // Initialize parameters array

    // Apply filters using the helper functions
    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    // Apply numerical filters
    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    // Add the GROUP BY clause after all WHERE conditions
    query += " GROUP BY el.name";

    // Optional: Add ORDER BY for consistent sorting
    query += " ORDER BY el.name ASC";

    console.log("Education Distribution Query:", query); // Log the constructed query for debugging
    console.log("Education Distribution Params:", params); // Log parameters

    return dbAsync
      .all(query, params)
      .then((results) => {
        // Map results to the format expected by the frontend, handling potential nulls
        return results.map((item) => ({
          name: item.name ? String(item.name).charAt(0).toUpperCase() + String(item.name).slice(1).toLowerCase() : 'Unknown',
          value: item.value || 0,
        }));
      });
  },

  // Skill distribution
  getSkillDistribution(filters = {}) {
    // Extract all potential filters
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    // Start with the base query including the initial WHERE clause
    let query = `
      SELECT s.name, COUNT(*) as value 
      FROM artisansView a 
      JOIN techniques s ON a.skill_id = s.id 
      WHERE a.isActive = 1
    `;
    const params = []; // Initialize parameters array

    // Apply filters using the helper functions
    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    // Apply numerical filters
    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    // Add the GROUP BY clause after all WHERE conditions
    query += " GROUP BY s.name";

    // Add ORDER BY for consistent sorting
    query += " ORDER BY s.name ASC";

    console.log("Skill Distribution Query:", query); // Log the constructed query for debugging
    console.log("Skill Distribution Params:", params); // Log parameters

    return dbAsync
      .all(query, params)
      .then((results) => {
        // Map results to the format expected by the frontend, handling potential nulls
        return results.map((item) => ({
          name: item.name ? String(item.name).charAt(0).toUpperCase() + String(item.name).slice(1).toLowerCase() : 'Unknown',
          value: item.value || 0,
        }));
      });
  },

  // Employment type distribution
  getEmploymentTypeDistribution(filters = {}) {
    // Extract all potential filters
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    // Start with the base query including the initial WHERE clause
    let query = `
      SELECT et.name, COUNT(*) as value 
      FROM artisansView a 
      JOIN employment_types et ON a.employment_type_id = et.id 
      WHERE a.isActive = 1
    `;
    const params = []; // Initialize parameters array

    // Apply filters using the helper functions
    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    // Apply numerical filters
    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    // Add the GROUP BY clause after all WHERE conditions
    query += " GROUP BY et.name";

    // Add ORDER BY for consistent sorting
    query += " ORDER BY et.name ASC";

    console.log("Employment Type Distribution Query:", query); // Log the constructed query for debugging
    console.log("Employment Type Params:", params); // Log parameters

    return dbAsync
      .all(query, params)
      .then((results) => {
        // Map results to the format expected by the frontend, handling potential nulls
        return results.map((item) => ({
          name: item.name ? String(item.name).charAt(0).toUpperCase() + String(item.name).slice(1).toLowerCase() : 'Unknown',
          value: item.value || 0,
        }));
      });
  },

  // Division distribution
  getDivisionDistribution(filters = {}) {
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    let query = `
      SELECT division_name as name, COUNT(*) as value 
      FROM artisansView a 
      WHERE a.isActive = 1
    `;
    const params = [];

    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    query += " GROUP BY division_name";
    query += " ORDER BY value DESC";
    query += " LIMIT 5";

    console.log("Division Distribution Query:", query);
    console.log("Division Distribution Params:", params);

    return dbAsync
      .all(query, params)
      .then((results) => {
        return results.map((item) => ({
          name: item.name ? String(item.name).charAt(0).toUpperCase() + String(item.name).slice(1).toLowerCase() : 'Unknown',
          value: item.value || 0,
        }));
      });
  },
  // District distribution
  getDistrictDistribution(filters = {}) {
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    let query = `
      SELECT a.district_name as name, COUNT(*) as value 
      FROM artisansView a 
      WHERE a.isActive = 1
    `;
    const params = [];

    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    query += " GROUP BY a.district_name";
    query += " ORDER BY name ASC";

    console.log("District Distribution Query:", query);
    console.log("District Distribution Params:", params);

    return dbAsync
      .all(query, params)
      .then((results) => {
        return results.map((item) => ({
          name: item.name ? String(item.name).charAt(0).toUpperCase() + String(item.name).slice(1).toLowerCase() : 'Unknown',
          value: item.value || 0,
        }));
      });
  },
  // Tehsil distribution
  getTehsilDistribution(filters = {}) {
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    let query = `
      SELECT a.tehsil_name as name, COUNT(*) as value 
      FROM artisansView a 
      WHERE a.isActive = 1
    `;
    const params = [];

    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    query += " GROUP BY a.tehsil_name";
    query += " ORDER BY name ASC";

    console.log("Tehsil Distribution Query:", query);
    console.log("Tehsil Distribution Params:", params);

    return dbAsync
      .all(query, params)
      .then((results) => {
        return results.map((item) => ({
          name: item.name ? String(item.name).charAt(0).toUpperCase() + String(item.name).slice(1).toLowerCase() : 'Unknown',
          value: item.value || 0,
        }));
      });
  },

  // Skill Distribution
  getTopSkillDistribution(filters = {}) {
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    let query = `
      SELECT a.skill_name as name, COUNT(*) as value 
      FROM artisansView a 
      WHERE a.isActive = 1
    `;
    const params = [];

    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    query += " GROUP BY a.skill_name";
    query += " ORDER BY value DESC";
    query += " LIMIT 5";

    console.log("Top Skill Distribution Query:", query);
    console.log("Top Skill Distribution Params:", params);

    return dbAsync
      .all(query, params)
      .then((results) => {
        return results.map((item) => ({
          name: item.name ? String(item.name).charAt(0).toUpperCase() + String(item.name).slice(1).toLowerCase() : 'Unknown',
          value: item.value || 0,
        }));
      });
  },
  // Yes/No fields distribution (loan status, machinery, training, etc.)
  getYesNoDistribution(field, filters = {}) {
    const validFields = [
      "loan_status",
      "has_machinery",
      "has_training",
      "inherited_skills",
      "financial_assistance",
      "technical_assistance",
    ];

    if (!validFields.includes(field)) {
      throw new Error("Invalid field name");
    }

    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    let query = `
      SELECT a.${field} as name, COUNT(*) as value 
      FROM artisansView a 
      WHERE a.isActive = 1
    `;
    const params = [];

    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    query += ` GROUP BY a.${field}`;
    query += ` ORDER BY a.${field} ASC`;

    console.log("Yes/No Distribution Query:", query);
    console.log("Yes/No Distribution Params:", params);

    return dbAsync
      .all(query, params)
      .then((results) => {
        return results.map((item) => ({
          name: item.name ? String(item.name).charAt(0).toUpperCase() + String(item.name).slice(1).toLowerCase() : 'Unknown',
          value: item.value || 0,
        }));
      });
  },

  // Average income by skill
  getAverageIncomeBySkill(filters = {}) {
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    let query = `
      SELECT a.skill_name as skill, ROUND(AVG(a.avg_monthly_income), 2) as avgIncome 
      FROM artisansView a 
      WHERE a.isActive = 1
    `;
    const params = [];

    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    query += " GROUP BY a.skill_name";
    query += " ORDER BY avgIncome DESC";

    console.log("Average Income by Skill Query:", query);
    console.log("Average Income by Skill Params:", params);

    return dbAsync
      .all(query, params)
      .then((results) => {
        return results.map((item) => ({
          skill: item.skill ? String(item.skill).charAt(0).toUpperCase() + String(item.skill).slice(1).toLowerCase() : 'Unknown',
          avgIncome: item.avgIncome || 0,
        }));
      });
  },

  // Age distribution
  getAgeDistribution(filters = {}) {
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    let query = `
      SELECT 
        CASE 
          WHEN (strftime('%Y', 'now') - strftime('%Y', a.date_of_birth)) < 13 THEN '0-12'
          WHEN (strftime('%Y', 'now') - strftime('%Y', a.date_of_birth)) >= 13 AND 
               (strftime('%Y', 'now') - strftime('%Y', a.date_of_birth)) < 19 THEN '13-18'
          WHEN (strftime('%Y', 'now') - strftime('%Y', a.date_of_birth)) >= 19 AND 
               (strftime('%Y', 'now') - strftime('%Y', a.date_of_birth)) < 25 THEN '19-24'
          WHEN (strftime('%Y', 'now') - strftime('%Y', 'now') - strftime('%Y', a.date_of_birth)) >= 25 AND 
               (strftime('%Y', 'now') - strftime('%Y', a.date_of_birth)) < 31 THEN '25-30'
          WHEN (strftime('%Y', 'now') - strftime('%Y', a.date_of_birth)) >= 31 AND 
               (strftime('%Y', 'now') - strftime('%Y', a.date_of_birth)) < 41 THEN '31-40'
          WHEN (strftime('%Y', 'now') - strftime('%Y', a.date_of_birth)) >= 41 AND 
               (strftime('%Y', 'now') - strftime('%Y', a.date_of_birth)) < 51 THEN '41-50'
          WHEN (strftime('%Y', 'now') - strftime('%Y', a.date_of_birth)) >= 51 AND 
               (strftime('%Y', 'now') - strftime('%Y', a.date_of_birth)) < 61 THEN '51-60'
          ELSE '60+'
        END as name, 
        COUNT(*) as value 
      FROM artisansView a 
      WHERE a.isActive = 1
    `;
    const params = [];

    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    query += " GROUP BY 1";
    query += " ORDER BY name ASC";

    console.log("Age Distribution Query:", query);
    console.log("Age Distribution Params:", params);

    return dbAsync
      .all(query, params)
      .then((results) => {
        return results.map((item) => ({
          name: item.name || 'Unknown',
          value: item.value || 0,
        }));
      });
  },

  // Experience distribution
  getExperienceDistribution(filters = {}) {
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    let query = `
      SELECT 
        CASE 
          WHEN a.experience <= 2 THEN '0-2'
          WHEN a.experience > 2 AND <= 4 THEN '2-4'
          WHEN a.experience > 4 AND <= 6 THEN '4-6'
          WHEN a.experience > 6 AND <= 8 THEN '6-8'
          WHEN a.experience > 8 AND <= 10 THEN '8-10'
          WHEN a.experience > 10 AND a.experience <= 15 THEN '10-15'
          ELSE '15+' 
        END as name, 
        COUNT(*) as value 
      FROM artisansView a 
      WHERE a.isActive = 1
    `;
    const params = [];

    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    query += " GROUP BY 1";
    query += " ORDER BY name ASC";

    console.log("Experience Distribution Query:", query);
    console.log("Experience Distribution Params:", params);

    return dbAsync
      .all(query, params)
      .then((results) => {
        return results.map((item) => ({
          name: item.name || 'Unknown',
          value: item.value || 0,
        }));
      });
  },

  // Income distribution
  getIncomeDistribution(filters = {}) {
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    let query = `
      SELECT 
        CASE 
          WHEN a.avg_monthly_income < 10000 THEN '0-10k'
          WHEN a.avg_monthly_income >= 10000 AND a.avg_monthly_income < 25000 THEN '10k-25k'
          WHEN a.avg_monthly_income >= 25000 AND a.avg_monthly_income < 50000 THEN '25k-50k'
          WHEN a.avg_monthly_income >= 50000 AND a.avg_monthly_income < 100000 THEN '50k-100k'
          ELSE '100k+' 
        END as name, 
        COUNT(*) as value 
      FROM artisansView a 
      WHERE a.isActive = 1
    `;
    const params = [];

    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    query += " GROUP BY 1";
    query += " ORDER BY name ASC";

    console.log("Income Distribution Query:", query);
    console.log("Income Distribution Params:", params);

    return dbAsync
      .all(query, params)
      .then((results) => {
        return results.map((item) => ({
          name: item.name || 'Unknown',
          value: item.value || 0,
        }));
      });
  },

  getDependentsDistribution(filters = {}) {
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    let query = `
      SELECT 
        CASE 
          WHEN a.dependents_count = 0 THEN '0'
          WHEN a.dependents_count >= 1 AND a.dependents_count <= 2 THEN '1-2'
          WHEN a.dependents_count >= 3 AND a.dependents_count <= 5 THEN '3-5'
          ELSE '6+' 
        END as name, 
        COUNT(*) as value 
      FROM artisansView a 
      WHERE a.isActive = 1
    `;
    const params = [];

    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    query += " GROUP BY 1";
    query += " ORDER BY name ASC";

    console.log("Dependents Distribution Query:", query);
    console.log("Dependents Distribution Params:", params);

    return dbAsync
      .all(query, params)
      .then((results) => {
        return results.map((item) => ({
          name: item.name || 'Unknown',
          value: item.value || 0,
        }));
      });
  },

  // Gender by tehsil (stacked)
  getGenderByTehsil(filters = {}) {
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    let query = `
      SELECT t.name as name, a.gender, COUNT(*) as value 
      FROM artisansView a 
      JOIN geo_level t ON a.tehsil_id = t.id 
      WHERE a.isActive = 1
    `;
    const params = [];

    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    query += " GROUP BY t.name, a.gender";
    query += " ORDER BY t.name ASC";

    console.log("Gender by Tehsil Query:", query);
    console.log("Gender by Tehsil Params:", params);

    return dbAsync
      .all(query, params)
      .then((rows) => {
        const tehsils = [...new Set(rows.map((r) => r.name))];
        return tehsils.map((tehsil) => {
          const tehsilData = { tehsil };
          rows
            .filter((r) => r.name === tehsil)
            .forEach((r) => {
              tehsilData[r.gender || 'Unknown'] = r.value || 0;
            });
          return tehsilData;
        });
      });
  },

  // Skill by employment type (stacked)
  getSkillByEmploymentType(filters = {}) {
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    let query = `
      SELECT s.name as skill, et.name as employment_type, COUNT(*) as value 
      FROM artisansView a 
      JOIN techniques s ON a.skill_id = s.id 
      JOIN employment_types et ON a.employment_type_id = et.id 
      WHERE a.isActive = 1
    `;
    const params = [];

    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    query += " GROUP BY s.name, et.name";
    query += " ORDER BY s.name ASC";

    console.log("Skill by Employment Type Query:", query);
    console.log("Skill by Employment Type Params:", params);

    return dbAsync
      .all(query, params)
      .then((rows) => {
        const skills = [...new Set(rows.map((r) => r.skill))];
        return skills.map((skill) => {
          const skillData = { skill };
          rows
            .filter((r) => r.skill === skill)
            .forEach((r) => {
              skillData[r.employment_type || 'Unknown'] = r.value || 0;
            });
          return skillData;
        });
      });
  },

  // Registrations over time
  getRegistrationsOverTime(filters = {}) {
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    let query = `
      SELECT strftime('%Y-%m-%d', a.created_at) as name, COUNT(*) as value 
      FROM artisansView a 
      WHERE a.isActive = 1
    `;
    const params = [];

    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    query += " GROUP BY 1";
    query += " ORDER BY name ASC";

    console.log("Registrations Over Time Query:", query);
    console.log("Registrations Over Time Params:", params);

    return dbAsync
      .all(query, params)
      .then((results) => {
        return results.map((item) => ({
          name: item.name || 'Unknown',
          value: item.value || 0,
        }));
      });
  },
  // Cumulative registrations over time
  getCumulativeRegistrations(filters = {}) {
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    let query = `
      SELECT strftime('%Y-%m', a.created_at) as month, COUNT(*) as monthly_count 
      FROM artisansView a 
      WHERE a.isActive = 1
    `;
    const params = [];

    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    query += " GROUP BY month";
    query += " ORDER BY month ASC";

    console.log("Cumulative Registrations Query:", query);
    console.log("Cumulative Registrations Params:", params);

    return dbAsync
      .all(query, params)
      .then((rows) => {
        let runningTotal = 0;
        return rows.map((row) => {
          runningTotal += row.monthly_count || 0;
          return {
            name: row.month || 'Unknown',
            value: runningTotal,
          };
        });
      });
  },

  // Experience vs income (scatter plot)
  getExperienceVsIncome(filters = {}) {
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    let query = `
      SELECT a.experience, a.avg_monthly_income as income 
      FROM artisansView a 
      WHERE a.isActive = 1
    `;
    const params = [];

    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    console.log("Experience vs Income Query:", query);
    console.log("Experience vs Income Params:", params);

    return dbAsync
      .all(query, params)
      .then((results) => {
        return results.map((item) => ({
          experience: item.experience || 0,
          income: item.income || 0,
        }));
      });
  },

  // Geographical distribution (for scatter plot/map)
  getGeographicalDistribution(filters = {}) {
    const {
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
      education,
      raw_material,
      employment_type,
      crafting_method,
      avg_monthly_income,
      dependents_count,
      inherited_skills,
      has_machinery,
      has_training,
      loan_status,
      financial_assistance,
      technical_assistance,
    } = filters;

    let query = `
      SELECT a.latitude, a.longitude, a.name, a.father_name 
      FROM artisansView a 
      WHERE a.isActive = 1
    `;
    const params = [];

    query = addFilterCondition(division, 'division_name', params, query);
    query = addFilterCondition(district, 'district_name', params, query);
    query = addFilterCondition(tehsil, 'tehsil_name', params, query);
    query = addFilterCondition(gender, 'gender', params, query);
    query = addFilterCondition(craft, 'craft_name', params, query);
    query = addFilterCondition(category, 'category_name', params, query);
    query = addFilterCondition(skill, 'skill_name', params, query);
    query = addFilterCondition(education, 'education', params, query);
    query = addFilterCondition(raw_material, 'raw_material', params, query);
    query = addFilterCondition(employment_type, 'employment_type', params, query);
    query = addFilterCondition(crafting_method, 'crafting_method', params, query);
    query = addFilterCondition(inherited_skills, 'inherited_skills', params, query);
    query = addFilterCondition(has_machinery, 'has_machinery', params, query);
    query = addFilterCondition(has_training, 'has_training', params, query);
    query = addFilterCondition(loan_status, 'loan_status', params, query);
    query = addFilterCondition(financial_assistance, 'financial_assistance', params, query);
    query = addFilterCondition(technical_assistance, 'technical_assistance', params, query);

    query = addNumericalRangeCondition(avg_monthly_income, 'avg_monthly_income', params, query);
    query = addNumericalRangeCondition(dependents_count, 'dependents_count', params, query);

    console.log("Geographical Distribution Query:", query);
    console.log("Geographical Distribution Params:", params);

    return dbAsync
      .all(query, params)
      .then((results) => {
        return results.map((item) => ({
          latitude: item.latitude || 0,
          longitude: item.longitude || 0,
          name: item.name ? String(item.name) : 'Unknown',
          father_name: item.father_name ? String(item.father_name) : 'Unknown',
        }));
      });
  },
};

/**
 * Route handlers with REST-compliant responses
 */
module.exports = (dependencies) => {
  const { logger } = dependencies;
  const handlers = {
    // Get gender distribution
    getDashboardData: createHandler(async (req, res) => {
      const field = req.query;
      const routeLogger = logger.child({
        route: "charts",
        handler: "getDashboardData",
        field,
      });
      routeLogger.info("Fetching gender distribution data");
      try {
        const data = await chartOps.getDashboardData(req.query);
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, "Error fetching gender distribution data");
        res.status(500).json({ error: error.message });
      }
    }),
    // Get gender distribution
    getGenderDistribution: createHandler(async (req, res) => {
      const field = req.query;
      const routeLogger = logger.child({
        route: "charts",
        handler: "getGenderDistribution",
        field,
      });
      routeLogger.info("Fetching gender distribution data");
      try {
        const data = await chartOps.getGenderDistribution(field);
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, "Error fetching gender distribution data");
        res.status(500).json({ error: error.message });
      }
    }),

    // Get education distribution
    getEducationDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "charts",
        handler: "getEducationDistribution",
      });
      routeLogger.info("Fetching education distribution data");
      try {
        const data = await chartOps.getEducationDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error(
          { error },
          "Error fetching education distribution data"
        );
        res.status(500).json({ error: error.message });
      }
    }),

    // Get skill distribution
    getSkillDistribution: createHandler(async (req, res) => {
      const field = req.query;
      const routeLogger = logger.child({
        route: "charts",
        handler: "getSkillDistribution",
        field
      });
      routeLogger.info("Fetching skill distribution data");
      try {
        const data = await chartOps.getSkillDistribution(field);
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, "Error fetching skill distribution data");
        res.status(500).json({ error: error.message });
      }
    }),

    // Get employment type distribution
    getEmploymentTypeDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "charts",
        handler: "getEmploymentTypeDistribution",
      });
      routeLogger.info("Fetching employment type distribution data");
      try {
        const data = await chartOps.getEmploymentTypeDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error(
          { error },
          "Error fetching employment type distribution data"
        );
        res.status(500).json({ error: error.message });
      }
    }),

    // Get division distribution
    getDivisionDistribution: createHandler(async (req, res) => {
      const field = req.query;
      const routeLogger = logger.child({
        route: "charts",
        handler: "getDivisionDistribution",
        field,
      });
      routeLogger.info("Fetching division distribution data");
      try {
        const data = await chartOps.getDivisionDistribution(field);
        res.json(data);
      } catch (error) {
        routeLogger.error(
          { error },
          "Error fetching division distribution data"
        );
        res.status(500).json({ error: error.message });
      }
    }),
    // Get district distribution
    getDistrictDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "charts",
        handler: "getDistrictDistribution",
      });
      routeLogger.info("Fetching district distribution data");
      try {
        const data = await chartOps.getDistrictDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error(
          { error },
          "Error fetching district distribution data"
        );
        res.status(500).json({ error: error.message });
      }
    }),
    // Get tehsil distribution
    getTehsilDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "charts",
        handler: "getTehsilDistribution",
      });
      routeLogger.info("Fetching tehsil distribution data");
      try {
        const data = await chartOps.getTehsilDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, "Error fetching tehsil distribution data");
        res.status(500).json({ error: error.message });
      }
    }),
    // Get top skill
    getTopSkillDistribution: createHandler(async (req, res) => {
      const field = req.query;
      const routeLogger = logger.child({
        route: "charts",
        handler: "getTopSkillDistribution",
        field,
      });
      routeLogger.info("Fetching top skill data");
      try {
        const data = await chartOps.getTopSkillDistribution(field);
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, "Error fetching top skill data");
        res.status(500).json({ error: error.message });
      }
    }),

    // Get Yes/No field distribution
    getYesNoDistribution: createHandler(async (req, res) => {
      const field = req.query;
      const routeLogger = logger.child({
        route: "charts",
        handler: "getYesNoDistribution",
        field,
      });
      routeLogger.info(`Fetching ${field} distribution data`);
      try {
        const data = await chartOps.getYesNoDistribution(field);
        res.json(data);
      } catch (error) {
        routeLogger.error(
          { error },
          `Error fetching ${field} distribution data`
        );
        res.status(500).json({ error: error.message });
      }
    }),

    // Get average income by skill
    getAverageIncomeBySkill: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "charts",
        handler: "getAverageIncomeBySkill",
      });
      routeLogger.info("Fetching average income by skill data");
      try {
        const data = await chartOps.getAverageIncomeBySkill();
        res.json(data);
      } catch (error) {
        routeLogger.error(
          { error },
          "Error fetching average income by skill data"
        );
        res.status(500).json({ error: error.message });
      }
    }),

    // Get age distribution
    getAgeDistribution: createHandler(async (req, res) => {
      const field = req.query;
      const routeLogger = logger.child({
        route: "charts",
        handler: "getAgeDistribution",
        field,
      });
      routeLogger.info("Fetching age distribution data");
      try {
        const data = await chartOps.getAgeDistribution(field);
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, "Error fetching age distribution data");
        res.status(500).json({ error: error.message });
      }
    }),

    // Get experience distribution
    getExperienceDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "charts",
        handler: "getExperienceDistribution",
      });
      routeLogger.info("Fetching experience distribution data");
      try {
        const data = await chartOps.getExperienceDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error(
          { error },
          "Error fetching experience distribution data"
        );
        res.status(500).json({ error: error.message });
      }
    }),

    // Get income distribution
    getIncomeDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "charts",
        handler: "getIncomeDistribution",
      });
      routeLogger.info("Fetching income distribution data");
      try {
        const data = await chartOps.getIncomeDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, "Error fetching income distribution data");
        res.status(500).json({ error: error.message });
      }
    }),

    // Get dependents distribution
    getDependentsDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "charts",
        handler: "getDependentsDistribution",
      });
      routeLogger.info("Fetching dependents distribution data");
      try {
        const data = await chartOps.getDependentsDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error(
          { error },
          "Error fetching dependents distribution data"
        );
        res.status(500).json({ error: error.message });
      }
    }),

    // Get gender by tehsil (stacked)
    getGenderByTehsil: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "charts",
        handler: "getGenderByTehsil",
      });
      routeLogger.info("Fetching gender by tehsil data");
      try {
        const data = await chartOps.getGenderByTehsil();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, "Error fetching gender by tehsil data");
        res.status(500).json({ error: error.message });
      }
    }),

    // Get skill by employment type (stacked)
    getSkillByEmploymentType: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "charts",
        handler: "getSkillByEmploymentType",
      });
      routeLogger.info("Fetching skill by employment type data");
      try {
        const data = await chartOps.getSkillByEmploymentType();
        res.json(data);
      } catch (error) {
        routeLogger.error(
          { error },
          "Error fetching skill by employment type data"
        );
        res.status(500).json({ error: error.message });
      }
    }),

    // Get registrations over time
    getRegistrationsOverTime: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "charts",
        handler: "getRegistrationsOverTime",
      });
      routeLogger.info("Fetching registrations over time data");
      try {
        const data = await chartOps.getRegistrationsOverTime();
        res.json(data);
      } catch (error) {
        routeLogger.error(
          { error },
          "Error fetching registrations over time data"
        );
        res.status(500).json({ error: error.message });
      }
    }),

    // Get cumulative registrations
    getCumulativeRegistrations: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "charts",
        handler: "getCumulativeRegistrations",
      });
      routeLogger.info("Fetching cumulative registrations data");
      try {
        const data = await chartOps.getCumulativeRegistrations();
        res.json(data);
      } catch (error) {
        routeLogger.error(
          { error },
          "Error fetching cumulative registrations data"
        );
        res.status(500).json({ error: error.message });
      }
    }),

    // Get experience vs income (scatter plot)
    getExperienceVsIncome: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "charts",
        handler: "getExperienceVsIncome",
      });
      routeLogger.info("Fetching experience vs income data");
      try {
        const data = await chartOps.getExperienceVsIncome();
        res.json(data);
      } catch (error) {
        routeLogger.error(
          { error },
          "Error fetching experience vs income data"
        );
        res.status(500).json({ error: error.message });
      }
    }),

    // Get geographical distribution
    getGeographicalDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "charts",
        handler: "getGeographicalDistribution",
      });
      routeLogger.info("Fetching geographical distribution data");
      try {
        const data = await chartOps.getGeographicalDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error(
          { error },
          "Error fetching geographical distribution data"
        );
        res.status(500).json({ error: error.message });
      }
    }),

    // Get all chart data in one request
    getAllChartData: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "charts",
        handler: "getAllChartData",
      });
      routeLogger.info("Fetching all chart data");

      try {
        // Define valid filter keys to prevent passing unexpected parameters
        const validFilters = [
          'division',
          'district',
          'tehsil',
          'gender',
          'craft',
          'category',
          'skill',
          'education',
          'raw_material',
          'employment_type',
          'crafting_method',
          'avg_monthly_income',
          'dependents_count',
          'inherited_skills',
          'has_machinery',
          'has_training',
          'loan_status',
          'financial_assistance',
          'technical_assistance',
        ];

        // Extract filters from query parameters, only including valid keys
        const filters = {};
        for (const key of validFilters) {
          if (req.query[key]) {
            filters[key] = req.query[key];
          }
        }

        routeLogger.info({ filters }, "Applying filters to chart data");

        const [
          genderDistribution,
          educationDistribution,
          skillDistribution,
          employmentTypeDistribution,
          tehsilDistribution,
          loanStatusDistribution,
          hasMachineryDistribution,
          hasTrainingDistribution,
          averageIncomeBySkill,
          ageDistribution,
          experienceDistribution,
          incomeDistribution,
          dependentsDistribution,
          genderByTehsil,
          skillByEmploymentType,
          registrationsOverTime,
          cumulativeRegistrations,
          experienceVsIncome,
          geographicalDistribution,
        ] = await Promise.all([
          chartOps.getGenderDistribution(filters),
          chartOps.getEducationDistribution(filters),
          chartOps.getSkillDistribution(filters),
          chartOps.getEmploymentTypeDistribution(filters),
          chartOps.getTehsilDistribution(filters),
          chartOps.getYesNoDistribution("loan_status", filters),
          chartOps.getYesNoDistribution("has_machinery", filters),
          chartOps.getYesNoDistribution("has_training", filters),
          chartOps.getAverageIncomeBySkill(filters),
          chartOps.getAgeDistribution(filters),
          chartOps.getExperienceDistribution(filters),
          chartOps.getIncomeDistribution(filters),
          chartOps.getDependentsDistribution(filters),
          chartOps.getGenderByTehsil(filters),
          chartOps.getSkillByEmploymentType(filters),
          chartOps.getRegistrationsOverTime(filters),
          chartOps.getCumulativeRegistrations(filters),
          chartOps.getExperienceVsIncome(filters),
          chartOps.getGeographicalDistribution(filters),
        ]);

        res.json({
          genderDistribution,
          educationDistribution,
          skillDistribution,
          employmentTypeDistribution,
          tehsilDistribution,
          loanStatusDistribution,
          hasMachineryDistribution,
          hasTrainingDistribution,
          averageIncomeBySkill,
          ageDistribution,
          experienceDistribution,
          incomeDistribution,
          dependentsDistribution,
          genderByTehsil,
          skillByEmploymentType,
          registrationsOverTime,
          cumulativeRegistrations,
          experienceVsIncome,
          geographicalDistribution,
        });
      } catch (error) {
        routeLogger.error({ error }, "Error fetching all chart data");
        res.status(500).json({ error: error.message });
      }
    }),
  };

  /**
   * @swagger
   * /charts/artisans:
   *   get:
   *     summary: Get artisans distribution
   *     responses:
   *       200:
   *         description: Artisans distribution data
   */
  router.get("/charts/dashboard", handlers.getDashboardData);

  /**
   * @swagger
   * /charts/gender:
   *   get:
   *     summary: Get gender distribution
   *     responses:
   *       200:
   *         description: Gender distribution data
   */
  router.get("/charts/gender", handlers.getGenderDistribution);

  /**
   * @swagger
   * /charts/education:
   *   get:
   *     summary: Get education level distribution
   *     responses:
   *       200:
   *         description: Education distribution data
   */
  router.get("/charts/education", handlers.getEducationDistribution);

  /**
   * @swagger
   * /charts/skill:
   *   get:
   *     summary: Get skill distribution
   *     responses:
   *       200:
   *         description: Skill distribution data
   */
  router.get("/charts/skill", handlers.getSkillDistribution);

  /**
   * @swagger
   * /charts/employment-type:
   *   get:
   *     summary: Get employment type distribution
   *     responses:
   *       200:
   *         description: Employment type distribution data
   */
  router.get("/charts/employment-type", handlers.getEmploymentTypeDistribution);

  /**
   * @swagger
   * /charts/division:
   *   get:
   *     summary: Get division distribution
   *     responses:
   *       200:
   *         description: Division distribution data
   */
  router.get("/charts/division", handlers.getDivisionDistribution);

  /**
   * @swagger
   * /charts/district:
   *   get:
   *     summary: Get district distribution
   *     responses:
   *       200:
   *         description: District distribution data
   */
  router.get("/charts/district", handlers.getDistrictDistribution);

  /**
   * @swagger
   * /charts/tehsil:
   *   get:
   *     summary: Get tehsil distribution
   *     responses:
   *       200:
   *         description: Tehsil distribution data
   */
  router.get("/charts/tehsil", handlers.getTehsilDistribution);

  /**
   * @swagger
   * /charts/topSkill:
   *   get:
   *     summary: Get topSkill distribution
   *     responses:
   *       200:
   *         description: topSkill distribution data
   */
  router.get("/charts/topSkill", handlers.getTopSkillDistribution);

  /**
   * @swagger
   * /charts/yes-no/{field}:
   *   get:
   *     summary: Get distribution for Yes/No fields
   *     parameters:
   *       - in: path
   *         name: field
   *         required: true
   *         description: Field name (loan_status, has_machinery, etc.)
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Field distribution data
   */
  router.get("/charts/yes-no/:field", handlers.getYesNoDistribution);

  /**
   * @swagger
   * /charts/income-by-skill:
   *   get:
   *     summary: Get average income by skill
   *     responses:
   *       200:
   *         description: Average income by skill data
   */
  router.get("/charts/income-by-skill", handlers.getAverageIncomeBySkill);

  /**
   * @swagger
   * /charts/age:
   *   get:
   *     summary: Get age distribution
   *     responses:
   *       200:
   *         description: Age distribution data
   */
  router.get("/charts/age", handlers.getAgeDistribution);

  /**
   * @swagger
   * /charts/experience:
   *   get:
   *     summary: Get experience distribution
   *     responses:
   *       200:
   *         description: Experience distribution data
   */
  router.get("/charts/experience", handlers.getExperienceDistribution);

  /**
   * @swagger
   * /charts/income:
   *   get:
   *     summary: Get income distribution
   *     responses:
   *       200:
   *         description: Income distribution data
   */
  router.get("/charts/income", handlers.getIncomeDistribution);

  /**
   * @swagger
   * /charts/dependents:
   *   get:
   *     summary: Get dependents distribution
   *     responses:
   *       200:
   *         description: Dependents distribution data
   */
  router.get("/charts/dependents", handlers.getDependentsDistribution);

  /**
   * @swagger
   * /charts/gender-by-tehsil:
   *   get:
   *     summary: Get gender distribution by tehsil
   *     responses:
   *       200:
   *         description: Gender by tehsil data (for stacked bar chart)
   */
  router.get("/charts/gender-by-tehsil", handlers.getGenderByTehsil);

  /**
   * @swagger
   * /charts/skill-by-employment:
   *   get:
   *     summary: Get skill distribution by employment type
   *     responses:
   *       200:
   *         description: Skill by employment type data (for stacked bar chart)
   */
  router.get("/charts/skill-by-employment", handlers.getSkillByEmploymentType);

  /**
   * @swagger
   * /charts/registrations-time:
   *   get:
   *     summary: Get registrations over time
   *     responses:
   *       200:
   *         description: Registrations over time data (for line chart)
   */
  router.get("/charts/registrations-time", handlers.getRegistrationsOverTime);

  /**
   * @swagger
   * /charts/cumulative-registrations:
   *   get:
   *     summary: Get cumulative registrations over time
   *     responses:
   *       200:
   *         description: Cumulative registrations data (for area chart)
   */
  router.get(
    "/charts/cumulative-registrations",
    handlers.getCumulativeRegistrations
  );

  /**
   * @swagger
   * /charts/experience-vs-income:
   *   get:
   *     summary: Get experience vs income data
   *     responses:
   *       200:
   *         description: Experience vs income data (for scatter plot)
   */
  router.get("/charts/experience-vs-income", handlers.getExperienceVsIncome);

  /**
   * @swagger
   * /charts/geographical:
   *   get:
   *     summary: Get geographical distribution
   *     responses:
   *       200:
   *         description: Geographical distribution data (for scatter/map)
   */
  router.get("/charts/geographical", handlers.getGeographicalDistribution);

  /**
   * @swagger
   * /charts/all:
   *   get:
   *     summary: Get all chart data in one request
   *     responses:
   *       200:
   *         description: All chart data
   */
  router.get("/charts/all", handlers.getAllChartData);

  return router;
};
