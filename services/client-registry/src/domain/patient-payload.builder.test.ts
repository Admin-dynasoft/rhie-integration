import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PatientPayloadBuilder,
  serializePatientPayload,
} from './patient-payload.builder.js';
import type { PatientDataRow } from './types.js';

/** Reference row matching docs/client-registry-payload-mapping.md example */
const SAMPLE_ROW: PatientDataRow = {
  UPID: '602645-3179-7909',
  nida: '1199887766554433',
  full_names: 'Mukamana Jean',
  last_name: 'Mukamana',
  first_name: 'Jean',
  gender: 'F',
  marital_status: '1',
  phone: '0781234567',
  birthdate: '1990-05-15',
  rhie_status: 0,
  state: 'Kigali',
  state_id: 1,
  district: 'Gasabo',
  sector: 'Kimironko',
  cell: 'Kibagabaga',
  line: 'Gasabo, Kimironko, Kibagabaga',
  referral: true,
};

describe('PatientPayloadBuilder (PHP parity)', () => {
  const builder = new PatientPayloadBuilder();

  it('maps gender like PHP strtolower check', () => {
    assert.equal(builder.mapGender('M'), 'male');
    assert.equal(builder.mapGender('male'), 'male');
    assert.equal(builder.mapGender('1'), 'male');
    assert.equal(builder.mapGender('F'), 'female');
    assert.equal(builder.mapGender('female'), 'female');
  });

  it('swaps name fields like PHP (family=given_name, given=family_name)', () => {
    const payload = builder.build(SAMPLE_ROW);
    assert.equal(payload.name[0].family, 'Jean');
    assert.equal(payload.name[0].given[0], 'Mukamana');
  });

  it('uses +25 phone prefix like PHP', () => {
    const payload = builder.build(SAMPLE_ROW);
    assert.equal(payload.telecom[0].value, '+250781234567');
  });

  it('hardcodes deceasedBoolean true like PHP', () => {
    const payload = builder.build(SAMPLE_ROW);
    assert.equal(payload.deceasedBoolean, true);
  });

  it('includes empty extension object like PHP stdClass', () => {
    const payload = builder.build(SAMPLE_ROW);
    assert.deepEqual(payload.extension, [{}]);
  });

  it('maps marital status codes like PHP', () => {
    assert.deepEqual(builder.mapMaritalStatus('1'), { code: 'M', display: 'Married' });
    assert.deepEqual(builder.mapMaritalStatus(0), { code: 'S', display: 'Single' });
    assert.deepEqual(builder.mapMaritalStatus('99'), { code: 'S', display: 'Single' });
  });

  it('produces full payload matching PHP buildPatientPayload structure', () => {
    const payload = builder.build(SAMPLE_ROW);

    assert.deepEqual(payload, {
      resourceType: 'Patient',
      id: '602645-3179-7909',
      identifier: [
        { system: 'UPI', value: '602645-3179-7909' },
        { system: 'NID', value: '1199887766554433' },
      ],
      active: true,
      name: [{ family: 'Jean', given: ['Mukamana'] }],
      gender: 'female',
      birthDate: '1990-05-15',
      deceasedBoolean: true,
      telecom: [{ system: 'phone', value: '+250781234567', use: 'mobile' }],
      address: [
        {
          type: 'physical',
          country: 'Rwanda',
          state: 'Kigali',
          district: 'Gasabo',
          line: 'Gasabo, Kimironko, Kibagabaga',
          city: 'Kigali',
          postalCode: '',
        },
      ],
      maritalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
            code: 'M',
            display: 'Married',
          },
        ],
      },
      extension: [{}],
    });
  });

  it('serializes payload as stable JSON (PHP JSON_UNESCAPED_SLASHES compatible)', () => {
    const payload = builder.build(SAMPLE_ROW);
    const serialized = serializePatientPayload(payload);
    assert.ok(serialized.includes('"resourceType":"Patient"'));
    assert.ok(serialized.includes('"deceasedBoolean":true'));
    assert.ok(!serialized.includes('\\/'));
  });
});
