package com.quickchop.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // Matches spring.servlet.multipart.max-file-size so the error message never drifts from config.
    @Value("${spring.servlet.multipart.max-file-size:6MB}")
    private String maxFileSize;

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(e -> fields.put(e.getField(), e.getDefaultMessage()));
        Map<String, Object> body = base(HttpStatus.BAD_REQUEST, "Validation failed");
        body.put("fields", fields);
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(ApiExceptions.NotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(ApiExceptions.NotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(base(HttpStatus.NOT_FOUND, ex.getMessage()));
    }

    @ExceptionHandler(ApiExceptions.BadRequestException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequest(ApiExceptions.BadRequestException ex) {
        return ResponseEntity.badRequest().body(base(HttpStatus.BAD_REQUEST, ex.getMessage()));
    }

    @ExceptionHandler(ApiExceptions.UnauthorizedException.class)
    public ResponseEntity<Map<String, Object>> handleUnauthorized(ApiExceptions.UnauthorizedException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(base(HttpStatus.UNAUTHORIZED, ex.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(base(HttpStatus.UNAUTHORIZED, ex.getMessage()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleUploadTooLarge(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(base(HttpStatus.PAYLOAD_TOO_LARGE,
                        "Image is too large. Maximum size is " + maxFileSize + "."));
    }

    @ExceptionHandler(ApiExceptions.StorageException.class)
    public ResponseEntity<Map<String, Object>> handleStorage(ApiExceptions.StorageException ex) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(base(HttpStatus.BAD_GATEWAY, ex.getMessage()));
    }

    @ExceptionHandler(ApiExceptions.ConflictException.class)
    public ResponseEntity<Map<String, Object>> handleConflict(ApiExceptions.ConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(base(HttpStatus.CONFLICT, ex.getMessage()));
    }

    /** Two writers updated the same delivery at once (optimistic lock on Delivery.version). */
    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<Map<String, Object>> handleOptimisticLock(ObjectOptimisticLockingFailureException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(base(HttpStatus.CONFLICT, "This was just updated by someone else. Refresh and try again."));
    }

    @ExceptionHandler(ApiExceptions.ForbiddenException.class)
    public ResponseEntity<Map<String, Object>> handleForbidden(ApiExceptions.ForbiddenException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(base(HttpStatus.FORBIDDEN, ex.getMessage()));
    }

    @ExceptionHandler(ApiExceptions.PoliciesNotAcceptedException.class)
    public ResponseEntity<Map<String, Object>> handlePolicies(ApiExceptions.PoliciesNotAcceptedException ex) {
        Map<String, Object> body = base(HttpStatus.FORBIDDEN, ex.getMessage());
        body.put("code", ApiExceptions.PoliciesNotAcceptedException.CODE);
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(base(HttpStatus.FORBIDDEN, "Access denied"));
    }

    @ExceptionHandler(ApiExceptions.LockedException.class)
    public ResponseEntity<Map<String, Object>> handleLocked(ApiExceptions.LockedException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(base(HttpStatus.TOO_MANY_REQUESTS, ex.getMessage()));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException ex) {
        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
        return ResponseEntity.status(status).body(base(status, ex.getReason()));
    }

    /** Unknown path (e.g. Swagger when it is switched off) — a plain 404, not a 500. */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNoResource(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(base(HttpStatus.NOT_FOUND, "Not found"));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadable(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest().body(base(HttpStatus.BAD_REQUEST, "Malformed request body"));
    }

    /**
     * Anything unexpected. The exception message is logged, not returned: messages from
     * JDBC, Hibernate or HTTP clients can carry SQL, table names, hostnames or keys, and
     * an error response is the easiest place for them to leak to the internet.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
        log.error("Unhandled error", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(base(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong. Please try again."));
    }

    private Map<String, Object> base(HttpStatus status, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", OffsetDateTime.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        return body;
    }
}
