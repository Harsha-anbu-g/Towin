package com.towinly.common.converter;

import com.towinly.common.enums.TrustLevel;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class TrustLevelConverter implements AttributeConverter<TrustLevel, Integer> {

    @Override
    public Integer convertToDatabaseColumn(TrustLevel level) {
        return level == null ? null : level.getValue();
    }

    @Override
    public TrustLevel convertToEntityAttribute(Integer value) {
        return value == null ? null : TrustLevel.fromValue(value);
    }
}
