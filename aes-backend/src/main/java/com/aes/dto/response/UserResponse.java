package com.aes.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UserResponse {

    private UUID id;
    private String name;
    private String phoneNumber;
    private String email;
    private String role;
    private long propertiesCount;
    private long acUnitsCount;

    /** Staff-only: present on CRM / SM / engineer / ops / admin payloads. */
    private Boolean onShift;
    private String branch;
}
