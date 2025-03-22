const express = require('express');
const db = require('../db');
const router = express.Router();
const { dbAsync, createHandler } = require('./base_route.js');

/**
 * Chart-specific database operations
 */
const chartOps = {
  // Gender distribution
  getGenderDistribution() {
    return dbAsync.all('SELECT gender, COUNT(*) as count FROM artisans GROUP BY gender');
  },

  // Education level distribution
  getEducationDistribution() {
    return dbAsync.all(`
      SELECT el.name, COUNT(*) as count 
      FROM artisans a 
      JOIN education_levels el ON a.education_level_id = el.id 
      GROUP BY el.name
    `);
  },

  // Skill distribution
  getSkillDistribution() {
    return dbAsync.all(`
      SELECT s.name, COUNT(*) as count 
      FROM artisans a 
      JOIN skills s ON a.skill_id = s.id 
      GROUP BY s.name
    `);
  },

  // Employment type distribution
  getEmploymentTypeDistribution() {
    return dbAsync.all(`
      SELECT et.name, COUNT(*) as count 
      FROM artisans a 
      JOIN employment_types et ON a.employment_type_id = et.id 
      GROUP BY et.name
    `);
  },

  // Tehsil distribution
  getTehsilDistribution() {
    return dbAsync.all(`
      SELECT t.name, COUNT(*) as count 
      FROM artisans a 
      JOIN tehsils t ON a.tehsil_id = t.id 
      GROUP BY t.name
    `);
  },

  // Yes/No fields distribution (loan status, machinery, training, etc.)
  getYesNoDistribution(field) {
    const validFields = ['loan_status', 'has_machinery', 'has_training',
      'inherited_skills', 'financial_assistance', 'technical_assistance'];

    if (!validFields.includes(field)) {
      throw new Error('Invalid field name');
    }

    return dbAsync.all(`SELECT ${field}, COUNT(*) as count FROM artisans GROUP BY ${field}`);
  },

  // Average income by skill
  getAverageIncomeBySkill() {
    return dbAsync.all(`
      SELECT s.name, ROUND(AVG(a.avg_monthly_income), 2) as avg_income 
      FROM artisans a 
      JOIN skills s ON a.skill_id = s.id 
      GROUP BY s.name
    `);
  },

  // Age distribution
  getAgeDistribution() {
    return dbAsync.all(`
      SELECT 
        CASE 
          WHEN (strftime('%Y', 'now') - strftime('%Y', date_of_birth)) < 18 THEN '0-17'
          WHEN (strftime('%Y', 'now') - strftime('%Y', date_of_birth)) >= 18 AND 
               (strftime('%Y', 'now') - strftime('%Y', date_of_birth)) < 30 THEN '18-29'
          WHEN (strftime('%Y', 'now') - strftime('%Y', date_of_birth)) >= 30 AND 
               (strftime('%Y', 'now') - strftime('%Y', date_of_birth)) < 45 THEN '30-44'
          ELSE '45+'
        END as age_group, 
        COUNT(*) as count 
      FROM artisans
      GROUP BY age_group
    `);
  },

  // Experience distribution
  getExperienceDistribution() {
    return dbAsync.all(`
      SELECT 
        CASE 
          WHEN experience <= 5 THEN '0-5'
          WHEN experience > 5 AND experience <= 10 THEN '6-10'
          ELSE '11+' 
        END as exp_range, 
        COUNT(*) as count 
      FROM artisans 
      GROUP BY exp_range
    `);
  },

  // Income distribution
  getIncomeDistribution() {
    return dbAsync.all(`
      SELECT 
        CASE 
          WHEN avg_monthly_income <= 1000 THEN '0-1000'
          WHEN avg_monthly_income > 1000 AND avg_monthly_income <= 2000 THEN '1001-2000'
          ELSE '2001+' 
        END as income_range, 
        COUNT(*) as count 
      FROM artisans 
      GROUP BY income_range
    `);
  },

  // Dependents count distribution
  getDependentsDistribution() {
    return dbAsync.all(`
      SELECT 
        CASE 
          WHEN dependents_count <= 2 THEN '0-2'
          WHEN dependents_count > 2 AND dependents_count <= 5 THEN '3-5'
          ELSE '6+' 
        END as dep_range, 
        COUNT(*) as count 
      FROM artisans 
      GROUP BY dep_range
    `);
  },

  // Gender by tehsil (stacked)
  getGenderByTehsil() {
    return dbAsync.all(`
      SELECT t.name as tehsil, a.gender, COUNT(*) as count 
      FROM artisans a 
      JOIN tehsils t ON a.tehsil_id = t.id 
      GROUP BY t.name, a.gender
    `).then(rows => {
      // Transform the data for stacked bar chart
      const tehsils = [...new Set(rows.map(r => r.tehsil))];
      const result = tehsils.map(tehsil => {
        const tehsilData = { tehsil };
        rows.filter(r => r.tehsil === tehsil).forEach(r => {
          tehsilData[r.gender] = r.count;
        });
        return tehsilData;
      });
      return result;
    });
  },

  // Skill by employment type (stacked)
  getSkillByEmploymentType() {
    return dbAsync.all(`
      SELECT s.name as skill, et.name as employment_type, COUNT(*) as count 
      FROM artisans a 
      JOIN skills s ON a.skill_id = s.id 
      JOIN employment_types et ON a.employment_type_id = et.id 
      GROUP BY s.name, et.name
    `).then(rows => {
      // Transform the data for stacked bar chart
      const skills = [...new Set(rows.map(r => r.skill))];
      const result = skills.map(skill => {
        const skillData = { skill };
        rows.filter(r => r.skill === skill).forEach(r => {
          skillData[r.employment_type] = r.count;
        });
        return skillData;
      });
      return result;
    });
  },

  // Registrations over time
  getRegistrationsOverTime() {
    return dbAsync.all(`
      SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count 
      FROM artisans 
      GROUP BY month 
      ORDER BY month
    `);
  },

  // Cumulative registrations over time
  getCumulativeRegistrations() {
    return dbAsync.all(`
      SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as monthly_count 
      FROM artisans 
      GROUP BY month 
      ORDER BY month
    `).then(rows => {
      let runningTotal = 0;
      return rows.map(row => {
        runningTotal += row.monthly_count;
        return {
          month: row.month,
          count: runningTotal
        };
      });
    });
  },

  // Experience vs income (scatter plot)
  getExperienceVsIncome() {
    return dbAsync.all(`
      SELECT experience, avg_monthly_income as income FROM artisans
    `);
  },

  // Geographical distribution (for scatter plot/map)
  getGeographicalDistribution() {
    return dbAsync.all(`
      SELECT latitude, longitude, name, father_name FROM artisans
    `);
  }
};

/**
 * Route handlers with REST-compliant responses
 */
module.exports = (dependencies) => {
  const { logger } = dependencies;
  const handlers = {
    // Get gender distribution
    getGenderDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'charts', handler: 'getGenderDistribution' });
      routeLogger.info('Fetching gender distribution data');
      try {
        const data = await chartOps.getGenderDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching gender distribution data');
        res.status(500).json({ error: error.message });
      }
    }),

    // Get education distribution
    getEducationDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'charts', handler: 'getEducationDistribution' });
      routeLogger.info('Fetching education distribution data');
      try {
        const data = await chartOps.getEducationDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching education distribution data');
        res.status(500).json({ error: error.message });
      }
    }),

    // Get skill distribution
    getSkillDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'charts', handler: 'getSkillDistribution' });
      routeLogger.info('Fetching skill distribution data');
      try {
        const data = await chartOps.getSkillDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching skill distribution data');
        res.status(500).json({ error: error.message });
      }
    }),

    // Get employment type distribution
    getEmploymentTypeDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'charts', handler: 'getEmploymentTypeDistribution' });
      routeLogger.info('Fetching employment type distribution data');
      try {
        const data = await chartOps.getEmploymentTypeDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching employment type distribution data');
        res.status(500).json({ error: error.message });
      }
    }),

    // Get tehsil distribution
    getTehsilDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'charts', handler: 'getTehsilDistribution' });
      routeLogger.info('Fetching tehsil distribution data');
      try {
        const data = await chartOps.getTehsilDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching tehsil distribution data');
        res.status(500).json({ error: error.message });
      }
    }),

    // Get Yes/No field distribution
    getYesNoDistribution: createHandler(async (req, res) => {
      const field = req.params.field;
      const routeLogger = logger.child({ route: 'charts', handler: 'getYesNoDistribution', field });
      routeLogger.info(`Fetching ${field} distribution data`);
      try {
        const data = await chartOps.getYesNoDistribution(field);
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, `Error fetching ${field} distribution data`);
        res.status(500).json({ error: error.message });
      }
    }),

    // Get average income by skill
    getAverageIncomeBySkill: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'charts', handler: 'getAverageIncomeBySkill' });
      routeLogger.info('Fetching average income by skill data');
      try {
        const data = await chartOps.getAverageIncomeBySkill();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching average income by skill data');
        res.status(500).json({ error: error.message });
      }
    }),

    // Get age distribution
    getAgeDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'charts', handler: 'getAgeDistribution' });
      routeLogger.info('Fetching age distribution data');
      try {
        const data = await chartOps.getAgeDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching age distribution data');
        res.status(500).json({ error: error.message });
      }
    }),

    // Get experience distribution
    getExperienceDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'charts', handler: 'getExperienceDistribution' });
      routeLogger.info('Fetching experience distribution data');
      try {
        const data = await chartOps.getExperienceDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching experience distribution data');
        res.status(500).json({ error: error.message });
      }
    }),

    // Get income distribution
    getIncomeDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'charts', handler: 'getIncomeDistribution' });
      routeLogger.info('Fetching income distribution data');
      try {
        const data = await chartOps.getIncomeDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching income distribution data');
        res.status(500).json({ error: error.message });
      }
    }),

    // Get dependents distribution
    getDependentsDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'charts', handler: 'getDependentsDistribution' });
      routeLogger.info('Fetching dependents distribution data');
      try {
        const data = await chartOps.getDependentsDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching dependents distribution data');
        res.status(500).json({ error: error.message });
      }
    }),

    // Get gender by tehsil (stacked)
    getGenderByTehsil: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'charts', handler: 'getGenderByTehsil' });
      routeLogger.info('Fetching gender by tehsil data');
      try {
        const data = await chartOps.getGenderByTehsil();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching gender by tehsil data');
        res.status(500).json({ error: error.message });
      }
    }),

    // Get skill by employment type (stacked)
    getSkillByEmploymentType: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'charts', handler: 'getSkillByEmploymentType' });
      routeLogger.info('Fetching skill by employment type data');
      try {
        const data = await chartOps.getSkillByEmploymentType();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching skill by employment type data');
        res.status(500).json({ error: error.message });
      }
    }),

    // Get registrations over time
    getRegistrationsOverTime: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'charts', handler: 'getRegistrationsOverTime' });
      routeLogger.info('Fetching registrations over time data');
      try {
        const data = await chartOps.getRegistrationsOverTime();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching registrations over time data');
        res.status(500).json({ error: error.message });
      }
    }),

    // Get cumulative registrations
    getCumulativeRegistrations: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'charts', handler: 'getCumulativeRegistrations' });
      routeLogger.info('Fetching cumulative registrations data');
      try {
        const data = await chartOps.getCumulativeRegistrations();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching cumulative registrations data');
        res.status(500).json({ error: error.message });
      }
    }),

    // Get experience vs income (scatter plot)
    getExperienceVsIncome: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'charts', handler: 'getExperienceVsIncome' });
      routeLogger.info('Fetching experience vs income data');
      try {
        const data = await chartOps.getExperienceVsIncome();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching experience vs income data');
        res.status(500).json({ error: error.message });
      }
    }),

    // Get geographical distribution
    getGeographicalDistribution: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'charts', handler: 'getGeographicalDistribution' });
      routeLogger.info('Fetching geographical distribution data');
      try {
        const data = await chartOps.getGeographicalDistribution();
        res.json(data);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching geographical distribution data');
        res.status(500).json({ error: error.message });
      }
    }),

    // Get all chart data in one request
    getAllChartData: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'charts', handler: 'getAllChartData' });
      routeLogger.info('Fetching all chart data');
      try {
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
          geographicalDistribution
        ] = await Promise.all([
          chartOps.getGenderDistribution(),
          chartOps.getEducationDistribution(),
          chartOps.getSkillDistribution(),
          chartOps.getEmploymentTypeDistribution(),
          chartOps.getTehsilDistribution(),
          chartOps.getYesNoDistribution('loan_status'),
          chartOps.getYesNoDistribution('has_machinery'),
          chartOps.getYesNoDistribution('has_training'),
          chartOps.getAverageIncomeBySkill(),
          chartOps.getAgeDistribution(),
          chartOps.getExperienceDistribution(),
          chartOps.getIncomeDistribution(),
          chartOps.getDependentsDistribution(),
          chartOps.getGenderByTehsil(),
          chartOps.getSkillByEmploymentType(),
          chartOps.getRegistrationsOverTime(),
          chartOps.getCumulativeRegistrations(),
          chartOps.getExperienceVsIncome(),
          chartOps.getGeographicalDistribution()
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
          geographicalDistribution
        });
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching all chart data');
        res.status(500).json({ error: error.message });
      }
    })
  };

  /**
   * @swagger
   * /charts/gender:
   *   get:
   *     summary: Get gender distribution
   *     responses:
   *       200:
   *         description: Gender distribution data
   */
  router.get('/charts/gender', handlers.getGenderDistribution);

  /**
   * @swagger
   * /charts/education:
   *   get:
   *     summary: Get education level distribution
   *     responses:
   *       200:
   *         description: Education distribution data
   */
  router.get('/charts/education', handlers.getEducationDistribution);

  /**
   * @swagger
   * /charts/skill:
   *   get:
   *     summary: Get skill distribution
   *     responses:
   *       200:
   *         description: Skill distribution data
   */
  router.get('/charts/skill', handlers.getSkillDistribution);

  /**
   * @swagger
   * /charts/employment-type:
   *   get:
   *     summary: Get employment type distribution
   *     responses:
   *       200:
   *         description: Employment type distribution data
   */
  router.get('/charts/employment-type', handlers.getEmploymentTypeDistribution);

  /**
   * @swagger
   * /charts/tehsil:
   *   get:
   *     summary: Get tehsil distribution
   *     responses:
   *       200:
   *         description: Tehsil distribution data
   */
  router.get('/charts/tehsil', handlers.getTehsilDistribution);

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
  router.get('/charts/yes-no/:field', handlers.getYesNoDistribution);

  /**
   * @swagger
   * /charts/income-by-skill:
   *   get:
   *     summary: Get average income by skill
   *     responses:
   *       200:
   *         description: Average income by skill data
   */
  router.get('/charts/income-by-skill', handlers.getAverageIncomeBySkill);

  /**
   * @swagger
   * /charts/age:
   *   get:
   *     summary: Get age distribution
   *     responses:
   *       200:
   *         description: Age distribution data
   */
  router.get('/charts/age', handlers.getAgeDistribution);

  /**
   * @swagger
   * /charts/experience:
   *   get:
   *     summary: Get experience distribution
   *     responses:
   *       200:
   *         description: Experience distribution data
   */
  router.get('/charts/experience', handlers.getExperienceDistribution);

  /**
   * @swagger
   * /charts/income:
   *   get:
   *     summary: Get income distribution
   *     responses:
   *       200:
   *         description: Income distribution data
   */
  router.get('/charts/income', handlers.getIncomeDistribution);

  /**
   * @swagger
   * /charts/dependents:
   *   get:
   *     summary: Get dependents distribution
   *     responses:
   *       200:
   *         description: Dependents distribution data
   */
  router.get('/charts/dependents', handlers.getDependentsDistribution);

  /**
   * @swagger
   * /charts/gender-by-tehsil:
   *   get:
   *     summary: Get gender distribution by tehsil
   *     responses:
   *       200:
   *         description: Gender by tehsil data (for stacked bar chart)
   */
  router.get('/charts/gender-by-tehsil', handlers.getGenderByTehsil);

  /**
   * @swagger
   * /charts/skill-by-employment:
   *   get:
   *     summary: Get skill distribution by employment type
   *     responses:
   *       200:
   *         description: Skill by employment type data (for stacked bar chart)
   */
  router.get('/charts/skill-by-employment', handlers.getSkillByEmploymentType);

  /**
   * @swagger
   * /charts/registrations-time:
   *   get:
   *     summary: Get registrations over time
   *     responses:
   *       200:
   *         description: Registrations over time data (for line chart)
   */
  router.get('/charts/registrations-time', handlers.getRegistrationsOverTime);

  /**
   * @swagger
   * /charts/cumulative-registrations:
   *   get:
   *     summary: Get cumulative registrations over time
   *     responses:
   *       200:
   *         description: Cumulative registrations data (for area chart)
   */
  router.get('/charts/cumulative-registrations', handlers.getCumulativeRegistrations);

  /**
   * @swagger
   * /charts/experience-vs-income:
   *   get:
   *     summary: Get experience vs income data
   *     responses:
   *       200:
   *         description: Experience vs income data (for scatter plot)
   */
  router.get('/charts/experience-vs-income', handlers.getExperienceVsIncome);

  /**
   * @swagger
   * /charts/geographical:
   *   get:
   *     summary: Get geographical distribution
   *     responses:
   *       200:
   *         description: Geographical distribution data (for scatter/map)
   */
  router.get('/charts/geographical', handlers.getGeographicalDistribution);

  /**
   * @swagger
   * /charts/all:
   *   get:
   *     summary: Get all chart data in one request
   *     responses:
   *       200:
   *         description: All chart data
   */
  router.get('/charts/all', handlers.getAllChartData);

  return router;
};