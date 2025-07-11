# Image Update API Endpoints

This document outlines the API endpoints for updating product and shop images.

## Product Image Update

-   **Endpoint:** `PUT /artisans/product-image`
-   **Method:** `PUT`
-   **Body:** `multipart/form-data` with two fields:
    -   `image_path`: The full path of the image to be replaced (e.g., `https://artisan-psic.com/uploads/product_images/image-1.jpeg`).
    -   `product_image`: The new image file.

## Shop Image Update

-   **Endpoint:** `PUT /artisans/shop-image`
-   **Method:** `PUT`
-   **Body:** `multipart/form-data` with two fields:
    -   `image_path`: The full path of the image to be replaced (e.g., `https://artisan-psic.com/uploads/shop_images/image-1.jpeg`).
    -   `shop_image`: The new image file.

## Flow

1.  Fetch artisan details using the `GET /artisans/:id` endpoint.
2.  The response will contain arrays of `product_images` and `shop_images`, which are full URL paths.
3.  To update an image, send a `PUT` request to the appropriate endpoint (`/artisans/product-image` or `/artisans/shop-image`).
4.  The request body must be `multipart/form-data` and include the `image_path` of the image you want to replace and the new image file itself.
