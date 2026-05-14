package com.aes.service;

import com.aes.dto.request.UpdateUserRequest;
import com.aes.dto.response.UserResponse;
import com.aes.entity.User;
import com.aes.exception.NotFoundException;
import com.aes.repository.AcUnitRepository;
import com.aes.repository.PropertyRepository;
import com.aes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * User Service — profile read/update.
 *
 * Per Section 4.2 (lines 540-549):
 *   GET /api/v1/users/me  → profile with properties + AC units count
 *   PUT /api/v1/users/me  → update name + email
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PropertyRepository propertyRepository;
    private final AcUnitRepository acUnitRepository;

    /**
     * Get current user profile including properties + AC units count (line 545).
     */
    public UserResponse getUserProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId.toString()));

        long propertiesCount = propertyRepository.countByCustomerId(userId);
        long acUnitsCount = acUnitRepository.countByCustomerId(userId);

        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .phoneNumber(user.getPhoneNumber())
                .email(user.getEmail())
                .role(user.getRole().name())
                .propertiesCount(propertiesCount)
                .acUnitsCount(acUnitsCount)
                .build();
    }

    /**
     * Update user profile (name, email) per lines 547-549.
     */
    @Transactional
    public UserResponse updateProfile(UUID userId, UpdateUserRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId.toString()));

        if (request.getName() != null) {
            user.setName(request.getName());
        }
        if (request.getEmail() != null) {
            user.setEmail(request.getEmail());
        }

        userRepository.save(user);

        return getUserProfile(userId);
    }
}
