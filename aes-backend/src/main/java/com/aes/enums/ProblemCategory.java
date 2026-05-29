package com.aes.enums;

/**
 * Customer-facing problem buckets used by the service-ticket wizard.
 *
 * <p>The ordering here mirrors the order shown on the wizard tile grid.
 * {@code SMELL_BURNING} was added to capture electrical / chemical
 * burning smells, which our CRM team treats as a P1-class safety
 * concern (escalates faster than the other tile choices).</p>
 */
public enum ProblemCategory {
    NOT_COOLING,
    NOISE,
    LEAKING,
    NOT_TURNING_ON,
    NO_AIRFLOW,
    REMOTE_WIFI,
    SMELL_BURNING,
    OTHER
}
