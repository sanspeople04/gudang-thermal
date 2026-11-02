import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf' },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 'bold' }
  ]
});

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Roboto', fontSize: 10, color: '#23322B' },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#23322B', paddingBottom: 10, marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  text: { marginBottom: 2, color: '#55645C' },
  bold: { fontWeight: 'bold', color: '#23322B' },
});

export default function InvoicePDF({ data, settings, docType, docNumber }: any) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{settings.name}</Text>
            <Text style={styles.text}>{settings.address}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.title}>{docType === 'invoice' ? 'INVOICE' : 'FAKTUR'}</Text>
            <Text style={styles.bold}>{docNumber}</Text>
          </View>
        </View>
        <Text style={{ textAlign: 'center', marginTop: 100 }}>Dokumen Tagihan Gudang Thermal</Text>
      </Page>
    </Document>
  );
}