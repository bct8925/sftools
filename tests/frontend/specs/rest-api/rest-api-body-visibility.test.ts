import { SftoolsTest } from '../../framework/base-test';

/**
 * Test REST API body editor visibility based on HTTP method
 *
 * Test IDs: R-F-006, R-F-007
 * - R-F-006: Body editor visible for POST/PATCH/PUT
 * - R-F-007: Body editor hidden for GET/DELETE
 */
export default class RestApiBodyVisibilityTest extends SftoolsTest {
  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to REST API tab
    await this.restApiTab.navigateTo();

    // Test R-F-006: Body editor visible for POST/PATCH/PUT
    await this.restApiTab.setMethod('POST');
    let isVisible = await this.restApiTab.isBodyEditorVisible();
    await this.expect(isVisible).toBe(true);

    await this.restApiTab.setMethod('PATCH');
    isVisible = await this.restApiTab.isBodyEditorVisible();
    await this.expect(isVisible).toBe(true);

    // Test R-F-007: Body editor hidden for GET/DELETE
    await this.restApiTab.setMethod('GET');
    isVisible = await this.restApiTab.isBodyEditorVisible();
    await this.expect(isVisible).toBe(false);

    await this.restApiTab.setMethod('DELETE');
    isVisible = await this.restApiTab.isBodyEditorVisible();
    await this.expect(isVisible).toBe(false);
  }
}
