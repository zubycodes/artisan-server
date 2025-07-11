const express = require("express");
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");
const { dbAsync } = require("./routes/base_route.js");

// Create Express router
const router = express.Router();

// Configuration constants
const CONFIG = {
  KEY_FILE_PATH: path.join(__dirname, "service-account-key.json"), // Update with your service account key file path
  DB_FILE_PATH: path.join(__dirname, "artisan_db.db"),
  DRIVE_FOLDER_ID: "YOUR_GOOGLE_DRIVE_FOLDER_ID", // Replace with your actual Google Drive folder ID
};

// Google Drive API setup
let drive = null;

/**
 * Initialize Google Drive API authentication
 */
const initializeDriveAPI = async () => {
  try {
    // Check if service account key file exists
    if (!fs.existsSync(CONFIG.KEY_FILE_PATH)) {
      throw new Error(`Service account key file not found at: ${CONFIG.KEY_FILE_PATH}`);
    }

    // Initialize Google Auth
    const auth = new google.auth.GoogleAuth({
      keyFile: CONFIG.KEY_FILE_PATH,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    // Create Drive API client
    drive = google.drive({ version: "v3", auth });
    
    return drive;
  } catch (error) {
    throw new Error(`Failed to initialize Google Drive API: ${error.message}`);
  }
};

/**
 * Get all files from Google Drive folder
 * @returns {Map} Map with filename as key and file ID as value
 */
const getGoogleDriveFiles = async () => {
  try {
    if (!drive) {
      await initializeDriveAPI();
    }

    const fileMap = new Map();
    let nextPageToken = null;

    do {
      const response = await drive.files.list({
        q: `'${CONFIG.DRIVE_FOLDER_ID}' in parents and trashed=false`,
        fields: "nextPageToken, files(id, name)",
        pageSize: 1000,
        pageToken: nextPageToken,
      });

      const files = response.data.files || [];
      
      // Add files to map for fast lookup
      files.forEach(file => {
        fileMap.set(file.name, file.id);
      });

      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    return fileMap;
  } catch (error) {
    throw new Error(`Failed to fetch Google Drive files: ${error.message}`);
  }
};

/**
 * Count total image records in database
 * @returns {Object} Object containing counts for each table
 */
const countDatabaseImages = async () => {
  try {
    const artisansCount = await dbAsync.get(
      "SELECT COUNT(*) as count FROM artisans WHERE profile_picture IS NOT NULL AND profile_picture != ''"
    );
    
    const shopImagesCount = await dbAsync.get(
      "SELECT COUNT(*) as count FROM shop_images WHERE image_path IS NOT NULL AND image_path != ''"
    );
    
    const productImagesCount = await dbAsync.get(
      "SELECT COUNT(*) as count FROM product_images WHERE image_path IS NOT NULL AND image_path != ''"
    );

    return {
      artisans: artisansCount.count,
      shop_images: shopImagesCount.count,
      product_images: productImagesCount.count,
      total: artisansCount.count + shopImagesCount.count + productImagesCount.count
    };
  } catch (error) {
    throw new Error(`Failed to count database images: ${error.message}`);
  }
};

/**
 * Generate Google Drive URL from file ID
 * @param {string} fileId - Google Drive file ID
 * @returns {string} Direct access URL
 */
const generateDriveUrl = (fileId) => {
  return `https://drive.google.com/uc?id=${fileId}`;
};

/**
 * Main migration endpoint
 */
router.get("/update-links", async (req, res) => {
  try {
    const mode = req.query.mode || "verify";

    switch (mode) {
      case "verify":
        await handleVerifyMode(req, res);
        break;
      case "dry-run":
        await handleDryRunMode(req, res);
        break;
      case "test-single":
        await handleTestSingleMode(req, res);
        break;
      case "execute":
        await handleExecuteMode(req, res);
        break;
      default:
        res.status(400).json({
          error: "Invalid mode. Use: verify, dry-run, test-single, or execute"
        });
    }
  } catch (error) {
    console.error("Migration error:", error);
    res.status(500).json({
      error: "Migration failed",
      details: error.message
    });
  }
});

/**
 * Phase 2: Verification Mode
 * Compare database image count with Google Drive file count
 */
const handleVerifyMode = async (req, res) => {
  console.log("Starting verification mode...");

  // Count database images
  const dbCounts = await countDatabaseImages();
  
  // Get Google Drive files and count them
  const driveFiles = await getGoogleDriveFiles();
  const googleDriveFileCount = driveFiles.size;

  const status = dbCounts.total === googleDriveFileCount ? "Counts match!" : "Counts do not match!";

  const response = {
    mode: "verify",
    status: status,
    totalDbImageCount: dbCounts.total,
    googleDriveFileCount: googleDriveFileCount,
    breakdown: {
      artisans: dbCounts.artisans,
      shop_images: dbCounts.shop_images,
      product_images: dbCounts.product_images
    }
  };

  console.log("Verification complete:", response);
  res.json(response);
};

/**
 * Phase 3: Dry Run Mode
 * Simulate the update process without making changes
 */
const handleDryRunMode = async (req, res) => {
  console.log("Starting dry run mode...");

  // Get Google Drive files map
  const driveFiles = await getGoogleDriveFiles();
  
  let plannedUpdates = 0;
  let notFoundFiles = 0;

  // Simulate updates for artisans table
  console.log("\n[DRY RUN] Artisans Table:");
  const artisans = await dbAsync.all(
    "SELECT id, profile_picture FROM artisans WHERE profile_picture IS NOT NULL AND profile_picture != '' LIMIT 10"
  );
  
  artisans.forEach(artisan => {
    const filename = artisan.profile_picture;
    const fileId = driveFiles.get(filename);
    
    if (fileId) {
      const newUrl = generateDriveUrl(fileId);
      console.log(`- ID: ${artisan.id}, Old: ${filename}, New: ${newUrl}`);
      plannedUpdates++;
    } else {
      console.log(`- ID: ${artisan.id}, File not found in Drive: ${filename}`);
      notFoundFiles++;
    }
  });

  // Simulate updates for shop_images table
  console.log("\n[DRY RUN] Shop Images Table:");
  const shopImages = await dbAsync.all(
    "SELECT id, image_path FROM shop_images WHERE image_path IS NOT NULL AND image_path != '' LIMIT 10"
  );
  
  shopImages.forEach(shopImage => {
    const filename = shopImage.image_path;
    const fileId = driveFiles.get(filename);
    
    if (fileId) {
      const newUrl = generateDriveUrl(fileId);
      console.log(`- ID: ${shopImage.id}, Old: ${filename}, New: ${newUrl}`);
      plannedUpdates++;
    } else {
      console.log(`- ID: ${shopImage.id}, File not found in Drive: ${filename}`);
      notFoundFiles++;
    }
  });

  // Simulate updates for product_images table
  console.log("\n[DRY RUN] Product Images Table:");
  const productImages = await dbAsync.all(
    "SELECT id, image_path FROM product_images WHERE image_path IS NOT NULL AND image_path != '' LIMIT 10"
  );
  
  productImages.forEach(productImage => {
    const filename = productImage.image_path;
    const fileId = driveFiles.get(filename);
    
    if (fileId) {
      const newUrl = generateDriveUrl(fileId);
      console.log(`- ID: ${productImage.id}, Old: ${filename}, New: ${newUrl}`);
      plannedUpdates++;
    } else {
      console.log(`- ID: ${productImage.id}, File not found in Drive: ${filename}`);
      notFoundFiles++;
    }
  });

  const response = {
    mode: "dry-run",
    status: "Dry run complete. Check console logs for detailed simulation.",
    plannedUpdates: plannedUpdates,
    filesNotFound: notFoundFiles,
    googleDriveFilesAvailable: driveFiles.size
  };

  console.log("\nDry run summary:", response);
  res.json(response);
};

/**
 * Phase 4: Single Record Test Mode
 * Update only one record from each table for testing
 */
const handleTestSingleMode = async (req, res) => {
  console.log("Starting test single mode...");

  // Get Google Drive files map
  const driveFiles = await getGoogleDriveFiles();
  
  const updatedRecords = [];

  try {
    // Test update for artisans table
    const artisan = await dbAsync.get(
      "SELECT id, profile_picture FROM artisans WHERE profile_picture IS NOT NULL AND profile_picture != '' LIMIT 1"
    );
    
    if (artisan) {
      const fileId = driveFiles.get(artisan.profile_picture);
      if (fileId) {
        const newUrl = generateDriveUrl(fileId);
        await dbAsync.run(
          "UPDATE artisans SET profile_picture = ? WHERE id = ?",
          [newUrl, artisan.id]
        );
        updatedRecords.push({
          table: "artisans",
          id: artisan.id,
          oldValue: artisan.profile_picture,
          newUrl: newUrl
        });
        console.log(`Updated artisan ID ${artisan.id}: ${artisan.profile_picture} -> ${newUrl}`);
      }
    }

    // Test update for shop_images table
    const shopImage = await dbAsync.get(
      "SELECT id, image_path FROM shop_images WHERE image_path IS NOT NULL AND image_path != '' LIMIT 1"
    );
    
    if (shopImage) {
      const fileId = driveFiles.get(shopImage.image_path);
      if (fileId) {
        const newUrl = generateDriveUrl(fileId);
        await dbAsync.run(
          "UPDATE shop_images SET image_path = ? WHERE id = ?",
          [newUrl, shopImage.id]
        );
        updatedRecords.push({
          table: "shop_images",
          id: shopImage.id,
          oldValue: shopImage.image_path,
          newUrl: newUrl
        });
        console.log(`Updated shop_image ID ${shopImage.id}: ${shopImage.image_path} -> ${newUrl}`);
      }
    }

    // Test update for product_images table
    const productImage = await dbAsync.get(
      "SELECT id, image_path FROM product_images WHERE image_path IS NOT NULL AND image_path != '' LIMIT 1"
    );
    
    if (productImage) {
      const fileId = driveFiles.get(productImage.image_path);
      if (fileId) {
        const newUrl = generateDriveUrl(fileId);
        await dbAsync.run(
          "UPDATE product_images SET image_path = ? WHERE id = ?",
          [newUrl, productImage.id]
        );
        updatedRecords.push({
          table: "product_images",
          id: productImage.id,
          oldValue: productImage.image_path,
          newUrl: newUrl
        });
        console.log(`Updated product_image ID ${productImage.id}: ${productImage.image_path} -> ${newUrl}`);
      }
    }

    const response = {
      mode: "test-single",
      status: "Single record test complete",
      updatedRecords: updatedRecords
    };

    console.log("Test single mode complete:", response);
    res.json(response);

  } catch (error) {
    throw new Error(`Test single mode failed: ${error.message}`);
  }
};

/**
 * Phase 5: Bulk Update Mode
 * Perform the full migration for all records
 */
const handleExecuteMode = async (req, res) => {
  console.log("Starting bulk update mode...");

  // Get Google Drive files map
  const driveFiles = await getGoogleDriveFiles();
  
  let artisansUpdated = 0;
  let shopImagesUpdated = 0;
  let productImagesUpdated = 0;

  try {
    // Update artisans table
    console.log("Updating artisans table...");
    const artisans = await dbAsync.all(
      "SELECT id, profile_picture FROM artisans WHERE profile_picture IS NOT NULL AND profile_picture != ''"
    );
    
    for (const artisan of artisans) {
      const fileId = driveFiles.get(artisan.profile_picture);
      if (fileId) {
        const newUrl = generateDriveUrl(fileId);
        await dbAsync.run(
          "UPDATE artisans SET profile_picture = ? WHERE id = ?",
          [newUrl, artisan.id]
        );
        artisansUpdated++;
        
        if (artisansUpdated % 100 === 0) {
          console.log(`Updated ${artisansUpdated} artisan records...`);
        }
      }
    }

    // Update shop_images table
    console.log("Updating shop_images table...");
    const shopImages = await dbAsync.all(
      "SELECT id, image_path FROM shop_images WHERE image_path IS NOT NULL AND image_path != ''"
    );
    
    for (const shopImage of shopImages) {
      const fileId = driveFiles.get(shopImage.image_path);
      if (fileId) {
        const newUrl = generateDriveUrl(fileId);
        await dbAsync.run(
          "UPDATE shop_images SET image_path = ? WHERE id = ?",
          [newUrl, shopImage.id]
        );
        shopImagesUpdated++;
        
        if (shopImagesUpdated % 100 === 0) {
          console.log(`Updated ${shopImagesUpdated} shop image records...`);
        }
      }
    }

    // Update product_images table
    console.log("Updating product_images table...");
    const productImages = await dbAsync.all(
      "SELECT id, image_path FROM product_images WHERE image_path IS NOT NULL AND image_path != ''"
    );
    
    for (const productImage of productImages) {
      const fileId = driveFiles.get(productImage.image_path);
      if (fileId) {
        const newUrl = generateDriveUrl(fileId);
        await dbAsync.run(
          "UPDATE product_images SET image_path = ? WHERE id = ?",
          [newUrl, productImage.id]
        );
        productImagesUpdated++;
        
        if (productImagesUpdated % 100 === 0) {
          console.log(`Updated ${productImagesUpdated} product image records...`);
        }
      }
    }

    const response = {
      mode: "execute",
      status: "Bulk update complete",
      artisans_updated: artisansUpdated,
      shop_images_updated: shopImagesUpdated,
      product_images_updated: productImagesUpdated,
      total_updated: artisansUpdated + shopImagesUpdated + productImagesUpdated
    };

    console.log("Bulk update complete:", response);
    res.json(response);

  } catch (error) {
    throw new Error(`Bulk update failed: ${error.message}`);
  }
};

// Export the router following the project's dependency injection pattern
module.exports = (dependencies) => {
  // The router can use injected dependencies if needed (db, logger, etc.)
  return router;
};
