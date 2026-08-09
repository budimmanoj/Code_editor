package dev.manoj.demo.enums;

public enum CodeReviewStatus {
    PENDING,    // User submitted, awaiting admin review
    REVIEWED,   // Admin approved (canonical version)
    REJECTED,   // Admin rejected, previous approved version stands
    NO_CHANGE   // Admin revert-to-previous operation
}
