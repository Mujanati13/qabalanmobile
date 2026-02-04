import React from 'react';
import { View, Text, StyleSheet, ScrollView, I18nManager } from 'react-native';

const AboutScreen: React.FC = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('about.aboutQabalanBakery')}</Text>

      <Text style={styles.paragraph}>
        Qabalan Bakeries was established in 1995 as a small family business. We entered the
        food industry inspired to make a difference in the market, and our mission was simple:
        to create high-quality bread and delicious pastries at a reasonable price. With years
        of hard work, passion, innovation and dedication, Qabalan Bakeries has become known
        across the Jordanian market as one of the unique bakeries. Moreover, our products have
        become favoured among several countries in the Middle East; thus, we have proudly
        expanded our sales in global supermarkets across the East and West.
      </Text>

      <Text style={styles.sectionHeading}>Gulfood 2025</Text>

      <Text style={styles.paragraph}>
        We are committed to making people happy with all our baked goods and products in which
        our quality exceeds expectations. We are distinguished by detail and proud of food
        safety. We continue to innovate and upgrade new and existing products.
      </Text>

      <Text style={styles.paragraph}>
        The Qabalan Group for Food Industries was established in 1995 as a family business
        specialising in bread, pastries and sweets. As a result of the group’s constant pursuit
        of innovation, development and leadership, it has become one of the most preferred
        destinations in the Jordanian market and has obtained the ISO 22000:2018 food-safety
        certification.
      </Text>

      <Text style={styles.link}>
        exhibitor-manual-004.s3.ap-south-1.amazonaws.com
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    marginBottom: 10,
  },
  link: {
    fontSize: 14,
    color: '#1890ff',
    marginTop: 8,
  },
});

export default AboutScreen;
