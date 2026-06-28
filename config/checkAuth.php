<?php
    /**
     * config/checkAuth.php
     *
     * Provides functions to enforce user authentication and role–based authorization.
     * Include this file on pages that require protection.
     *
     * If the user is not logged in, they will be redirected to login.php with an appropriate message.
     * If the user is logged in but not authorized to access the page (based on their role),
     * they will be redirected to 403.php.
     *
     * @package MedisoftV2
     */

    // Start the session if not already started.
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    /**
     * Checks if the user is logged in and optionally if they have one of the allowed roles.
     *
     * @param array $allowedRoles An array of allowed roles (posts). Pass an empty array to allow any logged-in user.
     */
    function checkAuthorization(array $allowedRoles = []) {
        // Check if the user is logged in.
        if (!isset($_SESSION['valid_user'])) {
            // Not logged in: redirect to login.php with a notification message.
            header("Location: login.php?message=" . urlencode("You must be logged in to access that page."));
            exit;
        }

        // If allowed roles are provided, check that the user's role is among them.
        if (!empty($allowedRoles)) {
            $userRole = isset($_SESSION['post']) ? strtolower($_SESSION['post']) : "";
            $allowedRoles = array_map('strtolower', $allowedRoles);
            if (!in_array($userRole, $allowedRoles)) {
                // Logged in but not authorized: redirect to a 403 Forbidden page.
                header("Location: 403.php");
                exit;
            }
        }
    }
?>
