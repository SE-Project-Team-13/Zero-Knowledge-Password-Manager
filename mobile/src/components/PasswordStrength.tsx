import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../theme';

interface PasswordStrengthProps {
  password: string;
  onStrengthChange?: (isValid: boolean) => void;
}

export default function PasswordStrength({ password, onStrengthChange }: PasswordStrengthProps) {
  const [strength, setStrength] = useState(0);
  const [criteria, setCriteria] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  useEffect(() => {
    if (!password) {
      setStrength(0);
      setCriteria({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false
      });
      onStrengthChange?.(false);
      return;
    }

    const newCriteria = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password)
    };

    setCriteria(newCriteria);
    const satisfied = Object.values(newCriteria).filter(Boolean).length;
    setStrength(satisfied / 5);
    onStrengthChange?.(satisfied === 5);
  }, [password, onStrengthChange]);

  const getStrengthColor = (s: number) => {
    if (s <= 0.2) return Colors.destructive;
    if (s <= 0.4) return '#F97316'; // orange-500
    if (s <= 0.6) return '#FACC15'; // yellow-400
    if (s <= 0.8) return '#3B82F6'; // blue-500
    return Colors.success;
  };

  const getStrengthLabel = (s: number) => {
    if (s <= 0.2) return 'Very Weak';
    if (s <= 0.4) return 'Weak';
    if (s <= 0.6) return 'Medium';
    if (s <= 0.8) return 'Strong';
    return 'Very Strong';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Password Strength</Text>
        <Text style={[styles.level, { color: getStrengthColor(strength) }]}>
          {getStrengthLabel(strength)}
        </Text>
      </View>

      <View style={styles.progressBarBackground}>
        <View 
          style={[
            styles.progressBarForeground, 
            { width: `${strength * 100}%`, backgroundColor: getStrengthColor(strength) }
          ]} 
        />
      </View>

      <View style={styles.criteriaGrid}>
        <CriteriaItem label="8+ Chars" met={criteria.length} />
        <CriteriaItem label="Uppercase" met={criteria.uppercase} />
        <CriteriaItem label="Lowercase" met={criteria.lowercase} />
        <CriteriaItem label="Number" met={criteria.number} />
        <CriteriaItem label="Special Char" met={criteria.special} />
      </View>

      <View style={styles.footer}>
        <Ionicons name="shield-checkmark-outline" size={14} color={Colors.textMuted} />
        <Text style={styles.footerText}>
          This password encrypts your vault locally. We never see it.
        </Text>
      </View>
    </View>
  );
}

function CriteriaItem({ label, met }: { label: string; met: boolean }) {
  return (
    <View style={styles.criteriaItem}>
      <Ionicons
        name={met ? "checkmark-circle" : "ellipse-outline"}
        size={14}
        color={met ? Colors.success : Colors.textMuted}
      />
      <Text style={[styles.criteriaText, met && styles.criteriaActive]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    backgroundColor: Colors.surfaceElevated || '#1A1A1A',
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  level: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.full,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarForeground: {
    height: '100%',
    borderRadius: Radius.full,
  },
  criteriaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  criteriaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
    marginBottom: 2,
  },
  criteriaText: {
    fontSize: 12,
    color: Colors.textDim,
    marginLeft: 4,
  },
  criteriaActive: {
    color: Colors.text,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  footerText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginLeft: 6,
    flex: 1,
  },
});
