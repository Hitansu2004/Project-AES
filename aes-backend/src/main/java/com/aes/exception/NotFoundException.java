package com.aes.exception;

import org.springframework.http.HttpStatus;

public class NotFoundException extends BusinessException {

    public NotFoundException(String resource, String identifier) {
        super(resource.toUpperCase() + "_NOT_FOUND",
              resource + " '" + identifier + "' not found",
              HttpStatus.NOT_FOUND);
    }
}
