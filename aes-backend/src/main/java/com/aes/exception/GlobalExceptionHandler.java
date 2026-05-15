package com.aes.exception;

import com.aes.dto.response.ApiResponse;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;

import java.util.stream.Collectors;

/**
 * Global exception handler — maps all internal errors to the standard
 * {@link ApiResponse} envelope and the HTTP codes required by Section 7
 * of the implementation prompt (lines 1692-1700).
 *
 * <pre>
 *   400 BAD_REQUEST       → validation failures, malformed JSON, bad enum / UUID
 *   401 UNAUTHORIZED      → missing or invalid JWT
 *   403 FORBIDDEN         → wrong role / ownership violation
 *   404 NOT_FOUND         → resource not found / no handler
 *   405 METHOD_NOT_ALLOWED→ wrong HTTP method
 *   409 CONFLICT          → handled at service layer via BusinessException
 *   422 UNPROCESSABLE     → handled at service layer via BusinessException
 *   429 TOO_MANY_REQUESTS → OTP rate limit (BusinessException)
 *   500 INTERNAL_ERROR    → unexpected server error
 * </pre>
 *
 * <p>Per Section 7 line 1702 — 500 errors log the full stack trace but never
 * leak internals to the client.</p>
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** All explicit business errors carry their own code + HTTP status. */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException ex) {
        log.warn("Business exception [{} {}]: {}", ex.getHttpStatus().value(), ex.getCode(), ex.getMessage());
        return ResponseEntity
                .status(ex.getHttpStatus())
                .body(ApiResponse.error(ex.getCode(), ex.getMessage()));
    }

    /** Bean Validation failures on {@code @Valid @RequestBody} payloads. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(this::formatFieldError)
                .collect(Collectors.joining(", "));
        log.warn("Validation error: {}", message);
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("VALIDATION_ERROR", message));
    }

    /** Bean Validation failures on path or query parameters. */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraintViolation(ConstraintViolationException ex) {
        String message = ex.getConstraintViolations().stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .collect(Collectors.joining(", "));
        log.warn("Constraint violation: {}", message);
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("VALIDATION_ERROR", message));
    }

    /** Malformed JSON body or unparseable enum value embedded in the body. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnreadableMessage(HttpMessageNotReadableException ex) {
        Throwable cause = ex.getMostSpecificCause();
        String code = "MALFORMED_REQUEST";
        String message = "Request body is malformed or contains an invalid value.";

        if (cause instanceof InvalidFormatException ife) {
            code = "INVALID_VALUE";
            String field = ife.getPath().isEmpty() ? "value"
                    : ife.getPath().get(ife.getPath().size() - 1).getFieldName();
            Class<?> targetType = ife.getTargetType();
            if (targetType != null && targetType.isEnum()) {
                String allowed = java.util.Arrays.stream(targetType.getEnumConstants())
                        .map(Object::toString)
                        .collect(Collectors.joining(", "));
                message = "Invalid value for '" + field + "'. Allowed values: " + allowed + ".";
            } else {
                message = "Invalid value for '" + field + "'.";
            }
        }
        log.warn("Bad request body: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(code, message));
    }

    /** Path / query parameter type mismatch (e.g. bad UUID, unknown enum value). */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        Class<?> requiredType = ex.getRequiredType();
        String typeName = requiredType != null ? requiredType.getSimpleName() : "value";
        String message = "Parameter '" + ex.getName() + "' has invalid value '" + ex.getValue() + "'. Expected " + typeName + ".";
        log.warn(message);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("INVALID_PARAMETER", message));
    }

    /** Required query parameter missing. */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingParam(MissingServletRequestParameterException ex) {
        String message = "Required parameter '" + ex.getParameterName() + "' is missing.";
        log.warn(message);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("MISSING_PARAMETER", message));
    }

    /** Unchecked enum-conversion failures from anywhere in the service layer. */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("Illegal argument: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("INVALID_ARGUMENT",
                        ex.getMessage() != null ? ex.getMessage() : "Invalid argument."));
    }

    /** Spring Security — authentication failed (e.g. malformed JWT downstream). */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuthentication(AuthenticationException ex) {
        log.warn("Authentication failure: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error("UNAUTHORIZED", "Authentication required."));
    }

    /** Spring Security — authenticated but lacking required role. */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("FORBIDDEN", "You do not have permission to perform this action."));
    }

    /** Wrong HTTP method for an endpoint. */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ApiResponse.error("METHOD_NOT_ALLOWED",
                        "HTTP method " + ex.getMethod() + " is not supported for this endpoint."));
    }

    /** Unknown route. */
    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoHandler(NoHandlerFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("NOT_FOUND", "Endpoint not found: " + ex.getRequestURL()));
    }

    /** Catch-all — never expose internals (Section 7, line 1702). */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericException(Exception ex) {
        log.error("Unexpected server error", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("INTERNAL_ERROR", "An unexpected error occurred. Please try again."));
    }

    private String formatFieldError(FieldError fe) {
        return fe.getField() + ": " + (fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "invalid");
    }
}
